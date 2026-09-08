const { extractZip } = require("../lib/extractZip");

const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Builds an uncompressed (store-mode) zip archive containing `entries`.
 *
 * Written by hand rather than with a zip library so the tests can emit entry names and
 * unix modes that no well-behaved writer would produce, which is exactly what the
 * traversal and link protections need to be exercised against.
 *
 * @param entries `{ name, contents, unixMode }` records. `unixMode` is optional, and when
 *                present is stored in the high 16 bits of the external attributes the way
 *                a unix-created archive does.
 */
function buildZip(entries) {
    const locals = [];
    const centrals = [];
    let offset = 0;

    for (const entry of entries) {
        const name = Buffer.from(entry.name, "utf8");
        const contents = Buffer.from(entry.contents || "", "utf8");
        const crc = crc32(contents);

        const local = Buffer.alloc(30 + name.length);
        local.writeUInt32LE(0x04034b50, 0); // local file header signature
        local.writeUInt16LE(10, 4); // version needed
        local.writeUInt16LE(0, 6); // flags
        local.writeUInt16LE(0, 8); // method: store
        local.writeUInt32LE(0, 10); // mod time/date
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(contents.length, 18); // compressed size
        local.writeUInt32LE(contents.length, 22); // uncompressed size
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28); // extra field length
        name.copy(local, 30);

        const central = Buffer.alloc(46 + name.length);
        central.writeUInt32LE(0x02014b50, 0); // central directory signature
        // "version made by": high byte 3 marks a unix-created archive, which is what makes
        // the external attributes' mode bits meaningful.
        central.writeUInt16LE(entry.unixMode === undefined ? 20 : (3 << 8) | 20, 4);
        central.writeUInt16LE(10, 6); // version needed
        central.writeUInt16LE(0, 8); // flags
        central.writeUInt16LE(0, 10); // method: store
        central.writeUInt32LE(0, 12); // mod time/date
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(contents.length, 20);
        central.writeUInt32LE(contents.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(0, 30); // extra field length
        central.writeUInt16LE(0, 32); // comment length
        central.writeUInt16LE(0, 34); // disk number
        central.writeUInt16LE(0, 36); // internal attributes
        central.writeUInt32LE(entry.unixMode === undefined ? 0 : (entry.unixMode << 16) >>> 0, 38);
        central.writeUInt32LE(offset, 42); // relative offset of local header
        name.copy(central, 46);

        locals.push(local, contents);
        centrals.push(central);
        offset += local.length + contents.length;
    }

    const centralDirectory = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
    end.writeUInt16LE(0, 4); // disk number
    end.writeUInt16LE(0, 6); // disk with central directory
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20); // comment length

    return Buffer.concat([...locals, centralDirectory, end]);
}

function crc32(buffer) {
    let crc = ~0;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }
    return (~crc >>> 0) >>> 0;
}

describe("extractZip", () => {
    let workdir;
    let destination;

    beforeEach(() => {
        workdir = fs.mkdtempSync(path.join(os.tmpdir(), "brs-extract-zip-"));
        destination = path.join(workdir, "out");
        fs.mkdirSync(destination);
    });

    afterEach(() => {
        fs.rmSync(workdir, { recursive: true, force: true });
    });

    /** Writes `entries` to a zip on disk and extracts it into `destination`. */
    async function extract(entries) {
        const zipPath = path.join(workdir, "archive.zip");
        fs.writeFileSync(zipPath, buildZip(entries));
        await extractZip(zipPath, destination);
    }

    it("extracts files and nested directories", async () => {
        await extract([
            { name: "manifest", contents: "title=test" },
            { name: "source/main.brs", contents: "sub main()\nend sub" },
        ]);

        expect(fs.readFileSync(path.join(destination, "manifest"), "utf8")).toBe("title=test");
        expect(fs.readFileSync(path.join(destination, "source", "main.brs"), "utf8")).toBe(
            "sub main()\nend sub"
        );
    });

    it("rejects entries that traverse above the destination", async () => {
        await expect(extract([{ name: "../escaped.brs", contents: "pwned" }])).rejects.toThrow(
            /invalid relative path/
        );

        expect(fs.existsSync(path.join(workdir, "escaped.brs"))).toBe(false);
    });

    it("rejects absolute entry paths", async () => {
        await expect(extract([{ name: "/tmp/escaped.brs", contents: "pwned" }])).rejects.toThrow(
            /absolute path/
        );
    });

    it("does not write entries into a sibling directory sharing the destination's prefix", async () => {
        // The abandoned `decompress` package compared paths with a bare prefix check, so
        // an entry landing in `<destination>-old` was treated as contained.
        const sibling = `${destination}-old`;
        fs.mkdirSync(sibling);

        await expect(
            extract([{ name: "../out-old/escaped.brs", contents: "pwned" }])
        ).rejects.toThrow(/invalid relative path/);

        expect(fs.existsSync(path.join(sibling, "escaped.brs"))).toBe(false);
    });

    it("skips symlink entries rather than creating them", async () => {
        const S_IFLNK = 0o120000;
        await extract([{ name: "link.brs", contents: "../../target", unixMode: S_IFLNK | 0o777 }]);

        expect(fs.existsSync(path.join(destination, "link.brs"))).toBe(false);
    });

    it("does not preserve setuid, setgid, or sticky bits from the archive", async () => {
        const S_IFREG = 0o100000;
        await extract([
            { name: "privileged.brs", contents: "sub main()\nend sub", unixMode: S_IFREG | 0o7777 },
        ]);

        const mode = fs.statSync(path.join(destination, "privileged.brs")).mode;
        expect(mode & 0o7000).toBe(0);
    });
});
