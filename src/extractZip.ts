import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import * as yauzl from "yauzl";

const mkdir = promisify(fs.mkdir);

/**
 * Extracts `zipPath` into `destination`.
 *
 * This replaces the abandoned `decompress` package (GHSA-qgfr-5hqp-vrw9,
 * GHSA-mp2f-45pm-3cg9, GHSA-h39j-r5qq-r9mm), which allowed archive entries to escape the
 * output directory. Only regular files and directories are written here: `yauzl` rejects
 * absolute and `..`-containing entry names outright, each resolved path is checked again
 * to confirm it stays inside `destination`, symlink entries are skipped rather than
 * followed, and entry modes from the archive are ignored so setuid/setgid/sticky bits can
 * never be applied.
 *
 * Component libraries on Roku are always zip archives, so zip is the only format needed.
 */
export async function extractZip(zipPath: string, destination: string): Promise<void> {
    const root = path.resolve(destination);

    const zipFile = await promisify<string, yauzl.Options, yauzl.ZipFile | undefined>(yauzl.open)(
        zipPath,
        { lazyEntries: true, autoClose: true }
    );

    if (!zipFile) {
        throw new Error(`Unable to open zip file '${zipPath}'`);
    }

    await new Promise<void>((resolve, reject) => {
        zipFile.on("error", reject);
        zipFile.on("end", resolve);

        zipFile.on("entry", (entry: yauzl.Entry) => {
            handleEntry(zipFile, entry, root)
                .then(() => zipFile.readEntry())
                .catch(reject);
        });

        zipFile.readEntry();
    });
}

/** Writes a single archive entry, skipping anything that isn't a contained regular file. */
async function handleEntry(
    zipFile: yauzl.ZipFile,
    entry: yauzl.Entry,
    root: string
): Promise<void> {
    // Reject absolute paths and any entry that traverses outside the destination. Compare
    // against `root + sep` so a sibling directory like `/srv/out-old` isn't treated as
    // living inside `/srv/out`.
    const target = path.resolve(root, entry.fileName);
    if (target !== root && !target.startsWith(root + path.sep)) {
        return;
    }

    if (isDirectoryEntry(entry)) {
        await mkdir(target, { recursive: true });
        return;
    }

    // Skip symlink entries entirely rather than recreating them; a link whose own name is
    // contained can still point anywhere on disk, which is how extraction escapes the
    // output directory.
    if (isLinkEntry(entry)) {
        return;
    }

    await mkdir(path.dirname(target), { recursive: true });

    const readStream = await promisify<yauzl.Entry, NodeJS.ReadableStream | undefined>(
        zipFile.openReadStream.bind(zipFile)
    )(entry);

    if (!readStream) {
        throw new Error(`Unable to read zip entry '${entry.fileName}'`);
    }

    await new Promise<void>((resolve, reject) => {
        // Deliberately no `mode` option: archive-provided permissions are discarded so
        // extraction can't produce a setuid/setgid/sticky file.
        const writeStream = fs.createWriteStream(target);
        readStream.on("error", reject);
        writeStream.on("error", reject);
        writeStream.on("close", resolve);
        readStream.pipe(writeStream);
    });
}

function isDirectoryEntry(entry: yauzl.Entry): boolean {
    return /[\/\\]$/.test(entry.fileName);
}

function isLinkEntry(entry: yauzl.Entry): boolean {
    // The file type lives in the high bits of the external attributes, which are only
    // meaningful for archives created on unix-like systems.
    const madeByUnix = entry.versionMadeBy >> 8 === 3;
    if (!madeByUnix) {
        return false;
    }
    const unixMode = entry.externalFileAttributes >>> 16;
    const S_IFMT = 0o170000;
    const S_IFLNK = 0o120000;
    return (unixMode & S_IFMT) === S_IFLNK;
}
