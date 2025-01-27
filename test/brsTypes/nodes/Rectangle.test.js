const brs = require("../../../lib");
const { Rectangle } = brs.types;

describe("Rectangle", () => {
    describe("stringification", () => {
        it("inits a new Rectangle component", () => {
            let group = new Rectangle();

            expect(group.toString()).toEqual(
                `<Component: roSGNode:Rectangle> =
{
    blendingenabled: true
    color: "0xFFFFFFFF"
    height: 0
    width: 0
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
