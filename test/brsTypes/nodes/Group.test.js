const brs = require("../../../lib");
const { Group } = brs.types;

describe("Group", () => {
    describe("stringification", () => {
        it("inits a new Group component", () => {
            let group = new Group();

            expect(group.toString()).toEqual(
                `<Component: roSGNode:Group> =
{
    rendertracking: "disabled"
    enablerendertracking: false
    muteaudioguide: false
    renderpass: 0
    clippingrect: <Component: roArray>
    inheritparentopacity: true
    inheritparenttransform: true
    childrenderorder: "renderLast"
    scalerotatecenter: <Component: roArray>
    scale: <Component: roArray>
    rotation: 0
    translation: <Component: roArray>
    opacity: 1
    visible: true
    change: <Component: roAssociativeArray>
    focusable: false
    focusedchild: <Component: roInvalid>
    id: ""
}`
            );
        });
    });
});
