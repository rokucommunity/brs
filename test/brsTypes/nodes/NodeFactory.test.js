const brs = require("../../../lib");
const { NodeFactory, RoSGNode, Callable, ValueKind } = brs.types;

describe("NodeFactory", () => {
    describe("createNode", () => {
        it("returns a properly constructed built in Node with default name", () => {
            const node = NodeFactory.createNode("Rectangle");
            expect(node.nodeSubtype).toBe("Rectangle");
            expect(node.name).toBe("Rectangle");
            expect(node.constructor.name).toBe("Rectangle");
        });
        it("returns a properly constructed built in Node with custom name", () => {
            const node = NodeFactory.createNode("Poster", "Foo");
            expect(node.nodeSubtype).toBe("Foo");
            expect(node.constructor.name).toBe("Poster");
        });
    });

    describe("addNodeTypes", () => {
        class Foo extends RoSGNode {
            constructor(initializedFields = [], name = "Foo") {
                super([], name);
                this.name = name;

                this.registerDefaultFields(this.defaultFields);
                this.registerInitializedFields(initializedFields);

                this.sayHello = new Callable("sayHello", {
                    signature: {
                        args: [],
                        returns: ValueKind.String,
                    },
                    impl: (_interpreter) => {
                        return "Hello world";
                    },
                });

                this.registerMethods({
                    ifHelloWorld: [this.sayHello],
                });
            }
        }

        it("adds a new Node to be constructed", () => {
            NodeFactory.addNodeTypes([
                [
                    "Foo",
                    (name) => {
                        return new Foo([], name);
                    },
                ],
            ]);
            const node = NodeFactory.createNode("Foo");
            expect(node.nodeSubtype).toBe("Foo");
            expect(node.name).toBe("Foo");
            expect(node.constructor.name).toBe("Foo");
        });
    });
});
