const brs = require("../../../lib");
const { TextEditBox } = brs.types;

describe("TextEditBox", () => {
    describe("stringification", () => {
        it("inits a new TextEditBox component", () => {
            let textEditBox = new TextEditBox();

            expect(textEditBox.toString()).toEqual(
                `<Component: roSGNode:TextEditBox> =
{
    backgrounduri: ""
    width: -1
    hinttextcolor: "OxFFFFFFFF"
    textcolor: "OxFFFFFFFF"
    active: false
    clearondownkey: true
    cursorposition: 0
    maxtextlength: 15
    hinttext: ""
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
