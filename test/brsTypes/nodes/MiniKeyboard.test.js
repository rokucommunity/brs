const brs = require("../../../lib");
const { MiniKeyboard } = brs.types;

describe("MiniKeyboard", () => {
    describe("stringification", () => {
        it("inits a new MiniKeyboard component", () => {
            let miniKeyboard = new MiniKeyboard();

            expect(miniKeyboard.toString()).toEqual(
                `<Component: roSGNode:MiniKeyboard> =
{
    lowercase: true
    showtexteditbox: true
    texteditbox: <Component: roSGNode:TextEditBox>
    focusbitmapuri: ""
    keyboardbitmapuri: ""
    focusedkeycolor: "0x000000FF"
    keycolor: "0x000000FF"
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
