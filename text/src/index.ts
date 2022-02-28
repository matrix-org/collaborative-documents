/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser } from "prosemirror-model";
import { schema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { exampleSetup } from "prosemirror-example-setup";
import { WidgetApi } from "matrix-widget-api";

import "prosemirror-view/style/prosemirror.css";
import "prosemirror-menu/style/menu.css";
import "./index.css";

// Mix the nodes from prosemirror-schema-list into the basic schema to
// create a schema with list support.
const mySchema = new Schema({
    nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"),
    marks: schema.spec.marks
});

const view = new EditorView(document.querySelector("#editor"), {
    state: EditorState.create({
        doc: DOMParser.fromSchema(mySchema).parse(document.querySelector("#content")),
        plugins: exampleSetup({ schema: mySchema }),
    }),
    dispatchTransaction(transaction) {
        console.log(transaction);
        const newState = view.state.apply(transaction)
        view.updateState(newState)
    },
});

// Widget communication
if (window.parent !== window) {
    const widgetId = new URL(document.documentURI).searchParams.get("widgetId");
    console.log(`Starting widget API (${widgetId})`);
    const widgetApi = new WidgetApi(widgetId);
    widgetApi.start();
    widgetApi.sendContentLoaded();
}
