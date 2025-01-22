// tslint:disable-next-line
import type { CoverageMapData } from "istanbul-lib-coverage";
import * as fg from "fast-glob";
import path from "path";

import { Stmt, Expr } from "../parser";
import { FileCoverage } from "./FileCoverage";
import { ComponentScript } from "../scenegraph";

export class CoverageCollector {
    /**
     * map of file paths => FileCoverage objects
     */
    private files = new Map<string, FileCoverage>();
    private scripts = new Array<ComponentScript>();

    constructor(
        readonly projectRoot: string,
        readonly parseFn: (filenames: ComponentScript[]) => Promise<Stmt.Statement[]>
    ) {}

    async crawlBrsFiles() {
        let filePattern = path.join(this.projectRoot, "(components|source)", "**", "*.brs");
        let brsFiles = fg.sync(filePattern);

        this.files.clear();
        this.scripts.length = 0;
        brsFiles.forEach((script) => {
            this.files.set(script, new FileCoverage(script));
            this.scripts.push({
                type: "text/brightscript",
                uri: script,
            });
        });

        let statements = await this.parseFn(this.scripts);

        statements.forEach((statement) => {
            let file = this.files.get(statement.location.file);
            if (file) {
                file.execute(statement);
            }
        });
    }

    logHit(statement: Expr.Expression | Stmt.Statement) {
        let file = this.files.get(statement.location.file);
        if (file) {
            file.logHit(statement);
        }
    }

    getCoverage() {
        let coverageMapData: CoverageMapData = {};
        this.files.forEach((file, key) => {
            coverageMapData[key] = file.getCoverage();
        });
        return coverageMapData;
    }
}
