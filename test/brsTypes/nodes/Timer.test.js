const brs = require("../../../lib");
const { Timer } = brs.types;

describe("Timer", () => {
    describe("stringification", () => {
        it("initializes a new Timer component", () => {
            let timer = new Timer();

            expect(timer.toString()).toEqual(
                `<Component: roSGNode:Timer> =
{
    fire: <UNINITIALIZED>
    duration: 0
    repeat: false
    control: ""
    change: <Component: roAssociativeArray>
    focusable: false
    focusedchild: <Component: roInvalid>
    id: ""
}`
            );
        });
    });
});
