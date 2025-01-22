const brs = require("../../../lib");
const { ArrayGrid } = brs.types;

describe("ArrayGrid", () => {
    describe("stringification", () => {
        it("inits a new ArrayGrid component", () => {
            let group = new ArrayGrid();

            expect(group.toString()).toEqual(
                `<Component: roSGNode:ArrayGrid> =
{
    currfocussection: 0
    currfocuscolumn: 0
    currfocusrow: 0
    animatetoitem: 0
    jumptoitem: 0
    itemunfocused: 0
    itemfocused: 0
    itemselected: 0
    itemclippingrect: <Component: roArray>
    sectiondividerleftoffset: 0
    sectiondividerminwidth: 0
    sectiondividerheight: 0
    sectiondividerwidth: 0
    sectiondividerspacing: 0
    sectiondividertextcolor: ""
    sectiondividerfont: <Component: roInvalid>
    sectiondividerbitmapuri: ""
    columnspacings: <Component: roArray>
    rowspacings: <Component: roArray>
    columnwidths: <Component: roArray>
    rowheights: <Component: roArray>
    numrenderpasses: 1
    fixedlayout: false
    wrapdividerheight: 36
    wrapdividerwidth: 0
    wrapdividerbitmapuri: ""
    focusfootprintblendcolor: "0xFFFFFFFF"
    focusbitmapblendcolor: "0xFFFFFFFF"
    focusfootprintbitmapuri: ""
    focusbitmapuri: ""
    currfocusfeedbackopacity: NaN
    fadefocusfeedbackwhenautoscrolling: false
    drawfocusfeedback: true
    drawfocusfeedbackontop: false
    vertfocusanimationstyle: "floatingFocus"
    horizfocusanimationstyle: "floatingFocus"
    focuscolumn: 0
    focusrow: 0
    numcolumns: 0
    numrows: 0
    itemspacing: <Component: roArray>
    itemsize: <Component: roArray>
    content: <Component: roInvalid>
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
