## Guidelines for adding node components to `brs`

This is aimed to be a quick guide for adding a node component to `brs`. Note that this may not be comprehensive in all cases, but is a general plan of attack. Here are the steps you should take:

1. Find the documentation for your component on [Roku's developer docs](https://developer.roku.com). For example, the documentation for the `Group` component can be found [here](https://developer.roku.com/docs/references/scenegraph/layout-group-nodes/group.md).
1. Create a file in the [nodes directory](https://github.com/rokucommunity/brs/tree/master/src/brsTypes/nodes) called `<insert component name>.ts`.
1. Copy the following code and paste it into your new file:

    ```
    import { FieldModel } from "./RoSGNode";
    import { AAMember } from "../components/RoAssociativeArray";

    export class <insert node name> extends <insert parent node> {
        readonly defaultFields: FieldModel[] = [
            // Add built-in fields here.
            // The fields can be found on the Roku docs.
        ];

        constructor(initializedFields: AAMember[] = [], readonly name: string = "<insert node name>") {
            super([], name);

            this.registerDefaultFields(this.defaultFields);
            this.registerInitializedFields(initializedFields);
        }
    }
    ```

1. Replace all `<insert node name>` and `<insert parent node>` from above with your node name. Add any built-in fields and/or class functions that the Roku docs specify.
1. Add a constructor definition to the [node factory](https://github.com/rokucommunity/brs/blob/main/src/brsTypes/nodes/NodeFactory.ts). This will allow instances of your new node to be created dynamically when it is encountered in XML or BrightScript code.
1. Add a test case for your Typescript class in [the nodes test directory](https://github.com/rokucommunity/brs/tree/master/test/brsTypes/nodes). Use the existing component test files in that directory as a model for what your test should look like.
1. Add an end-to-end test case.
    - Create a file in [the end-to-end directory](https://github.com/rokucommunity/brs/tree/master/test/e2e) called `<insert node name>.brs`. In the file, write BrightScript code that exercises your node functionality.
    - Add an XML file to the [the components test directory](https://github.com/rokucommunity/brs/tree/master/test/brsTypes/nodes) that uses your node.
    - Add a test block to [BrsComponents.test.js](https://github.com/rokucommunity/brs/blob/main/test/e2e/BrsComponents.test.js). In this block, verify that the code from your XML and Brightscript files is behaving as expected.
