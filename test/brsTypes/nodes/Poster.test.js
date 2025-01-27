const brs = require("../../../lib");
const { Poster } = brs.types;

describe("Poster", () => {
    describe("stringification", () => {
        it("inits a new Poster component", () => {
            let group = new Poster();

            expect(group.toString()).toEqual(
                `<Component: roSGNode:Poster> =
{
    audioguidetext: ""
    failedbitmapopacity: 1
    failedbitmapuri: ""
    loadingbitmapopacity: 1
    loadingbitmapuri: ""
    blendcolor: "0xFFFFFFFF"
    bitmapmargins: <Component: roAssociativeArray>
    bitmapheight: 0
    bitmapwidth: 0
    loadstatus: "noScale"
    loaddisplaymode: "noScale"
    loadheight: 0
    loadwidth: 0
    loadsync: false
    height: 0
    width: 0
    uri: ""
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
