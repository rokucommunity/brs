const brs = require("../../../lib");
const { Label } = brs.types;

describe("Label", () => {
    describe("stringification", () => {
        it("inits a new Label component", () => {
            let group = new Label();

            expect(group.toString()).toEqual(
                `<Component: roSGNode:Label> =
{
    istextellipsized: false
    ellipsistext: ""
    wordbreakchars: ""
    truncateondelimiter: ""
    ellipsizeonboundary: false
    displaypartiallines: false
    linespacing: 0
    wrap: false
    maxlines: 0
    numlines: 0
    height: 0
    width: 0
    vertalign: "top"
    horizalign: "left"
    font: <Component: roSGNode:Font>
    color: "0xddddddff"
    text: ""
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
