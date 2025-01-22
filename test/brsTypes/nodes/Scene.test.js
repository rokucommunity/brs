const brs = require("../../../lib");
const { Scene } = brs.types;

describe("Scene", () => {
    describe("stringification", () => {
        it("inits a new Scene component", () => {
            let scene = new Scene();

            expect(scene.toString()).toEqual(
                `<Component: roSGNode:Scene> =
{
    currentdesignresolution: <Component: roAssociativeArray>
    dialog: <Component: roInvalid>
    backexitsscene: true
    backgroundcolor: "0x000000FF"
    backgrounduri: ""
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
