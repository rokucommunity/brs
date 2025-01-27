const brs = require("../../../lib");
const { Font } = brs.types;

describe("Font", () => {
    describe("stringification", () => {
        it("inits a new Font component", () => {
            let group = new Font();

            expect(group.toString()).toEqual(
                `<Component: roSGNode:Font> =
{
    fallbackglyph: ""
    size: 24
    uri: ""
    change: <Component: roAssociativeArray>
    focusable: false
    focusedchild: <Component: roInvalid>
    id: ""
}`
            );
        });
    });
});
