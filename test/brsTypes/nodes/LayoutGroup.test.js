const brs = require("../../../lib");
const { LayoutGroup } = brs.types;

describe("LayoutGroup", () => {
    describe("stringification", () => {
        it("inits a new LayoutGroup component", () => {
            let group = new LayoutGroup();

            expect(group.toString()).toEqual(
                `<Component: roSGNode:LayoutGroup> =
{
    additemspacingafterchild: true
    itemspacings: <Component: roArray>
    vertalignment: "top"
    horizalignment: "left"
    layoutdirection: "vert"
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
