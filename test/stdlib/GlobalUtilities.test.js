const brs = require("../../lib");
const { RoAssociativeArray, BrsString, BrsInvalid, BrsInterface, RoSGNode, Int32 } = brs.types;
const { GetInterface, FindMemberFunction, ObjFun } = require("../../lib/stdlib");
const { Interpreter } = require("../../lib/interpreter");

describe("global utility functions", () => {
    let interpreter = new Interpreter();

    describe("GetInterface", () => {
        it("returns invalid for unimplemented interfaces", () => {
            let assocarray = new RoAssociativeArray([]);
            expect(GetInterface.call(interpreter, assocarray, new BrsString("ifArray"))).toBe(
                BrsInvalid.Instance
            );
        });

        it("returns an interface for implemented interfaces", () => {
            let assocarray = new RoAssociativeArray([]);
            let iface = GetInterface.call(
                interpreter,
                assocarray,
                new BrsString("ifAssociativeArray")
            );
            expect(iface).toBeInstanceOf(BrsInterface);
            expect(iface.name).toBe("ifAssociativeArray");
        });
    });

    describe("FindMemberFunction", () => {
        it("returns invalid if method isn't found in any interface", () => {
            let assocarray = new RoAssociativeArray([]);
            expect(
                FindMemberFunction.call(interpreter, assocarray, new BrsString("addField"))
            ).toBe(BrsInvalid.Instance);
        });

        it("addfield exists in ifSGNodeField of RoSGNode", () => {
            let node = new RoSGNode([]);
            let memberFunction = FindMemberFunction.call(
                interpreter,
                node,
                new BrsString("addfield")
            );

            expect(memberFunction).toBeInstanceOf(BrsInterface);
            expect(memberFunction.name).toBe("ifSGNodeField");
        });

        it("findNode exists in ifSGNodeDict of RoSGNode", () => {
            let node = new RoSGNode([]);
            let memberFunction = FindMemberFunction.call(
                interpreter,
                node,
                new BrsString("findNode")
            );

            expect(memberFunction).toBeInstanceOf(BrsInterface);
            expect(memberFunction.name).toBe("ifSGNodeDict");
        });
    });
    describe("ObjFun", () => {
        it("successfully call a method of a function with no arguments", () => {
            let assocarray = new RoAssociativeArray([
                { name: new BrsString("letter1"), value: new BrsString("a") },
                { name: new BrsString("letter2"), value: new BrsString("b") },
            ]);
            let iface = GetInterface.call(
                interpreter,
                assocarray,
                new BrsString("ifAssociativeArray")
            );
            expect(iface).toBeInstanceOf(BrsInterface);
            expect(iface.name).toBe("ifAssociativeArray");
            let result = ObjFun.call(interpreter, assocarray, iface, new BrsString("Count"));
            expect(result).toEqual(new Int32(2));
        });

        it("successfully call a method of a function with arguments", () => {
            let assocarray = new RoAssociativeArray([
                { name: new BrsString("letter1"), value: new BrsString("a") },
                { name: new BrsString("letter2"), value: new BrsString("b") },
            ]);
            let iface = GetInterface.call(
                interpreter,
                assocarray,
                new BrsString("ifAssociativeArray")
            );
            expect(iface).toBeInstanceOf(BrsInterface);
            expect(iface.name).toBe("ifAssociativeArray");
            let result = ObjFun.call(
                interpreter,
                assocarray,
                iface,
                new BrsString("lookup"),
                new BrsString("letter1")
            );
            expect(result).toEqual(new BrsString("a"));
        });
    });
});
