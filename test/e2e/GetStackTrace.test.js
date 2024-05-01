const { execute } = require("../../lib");
const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("GetStackTrace", () => {
    let outputStreams;

    beforeAll(() => {
        outputStreams = createMockStreams();
        outputStreams.root = __dirname + "/resources";
    });

    test("components/stack-trace/main.brs", async () => {
        await execute(
            [
                resourceFile("components", "stack-trace", "@external", "package", "utils.brs"),
                resourceFile("components", "stack-trace", "print.brs"),
                resourceFile("components", "stack-trace", "main.brs"),
            ],
            outputStreams
        );

        expect(
            allArgs(outputStreams.stdout.write)
                .filter((arg) => arg !== "\n")
                .map((line) => line.replace(process.cwd(), ""))
        ).toEqual([
            "--- stack ---",
            "test/e2e/resources/components/stack-trace/print.brs:2:12",
            "test/e2e/resources/components/stack-trace/print.brs:1:0",
            "test/e2e/resources/components/stack-trace/main.brs:5:0",
            "test/e2e/resources/components/stack-trace/@external/package/utils.brs:1:0",
            "test/e2e/resources/components/stack-trace/main.brs:1:0",
            "--- stack ---",
            "test/e2e/resources/components/stack-trace/print.brs:4:32",
            "--- stack ---",
            "test/e2e/resources/components/stack-trace/print.brs:6:37",
            "test/e2e/resources/components/stack-trace/print.brs:1:0",
            "test/e2e/resources/components/stack-trace/main.brs:5:0",
            "test/e2e/resources/components/stack-trace/main.brs:1:0",
            "--- stack ---",
            "test/e2e/resources/components/stack-trace/main.brs:5:0",
            "test/e2e/resources/components/stack-trace/main.brs:1:0",
        ]);
    });
});
