# Matrix-native collaborative documents

* Organiser: [J. Ryan Stinnett](https://matrix.to/#/@jryans:matrix.org)
* Status: Draft

## Overview

* Captures user intent when editing structured data
* Human-comprehensible event syntax is preferred over binary blobs to support a more open, interoperable ecosystem, matching the [guiding principles](https://spec.matrix.org/unstable/proposals/#guiding-principles) of Matrix overall
* Collaboration algorithms are rapidly evolving, so it would be unwise to attempt embedding any single algorithm in Matrix at this time
* Many existing and future collaboration algorithms can be used with the structure proposed here

## Documents as rooms

When you have documents stored natively in rooms, you can leverage all the existing Matrix access concepts to invite others, manage permissions, etc.
Document access is just the usual access to the room.

* Room name is the document name
* Spaces / [MSC3089: file tree structures](https://github.com/matrix-org/matrix-doc/pull/3089) provide directories
* Encrypted rooms protect document content
* Invite others to share the document with them
* History visibility controls public viewing and document publishing
* Power levels control read, comment, and edit access
* Chat messages allow for document discussion

## Document

> 💡 This document structure borrows many concepts from ProseMirror. Their [guide to documents](https://prosemirror.net/docs/guide/#doc) may be a useful reference.

A `document` event stores the tree of nodes that make up a document matching a [schema](#Schema).

```json
{
    "type": "m.document",
    "content": {
        "schema": "#basicmark:example.com@1.0.0",
        "content": [
            {
                "type": "heading",
                "attrs": {
                    "level": 3
                },
                "content": [
                    {
                        "type": "text",
                        "text": "Hello Matrix!"
                    }
                ]
            },
            {
                "type": "paragraph",
                "content": [
                    {
                        "type": "text",
                        "text": "The basic schema supports "
                    },
                    {
                        "type": "text",
                        "marks": [
                            {
                                "type": "em"
                            }
                        ],
                        "text": "italics"
                    },
                    {
                        "type": "text",
                        "text": ", "
                    },
                    {
                        "type": "text",
                        "marks": [
                            {
                                "type": "strong"
                            }
                        ],
                        "text": "bold"
                    },
                    {
                        "type": "text",
                        "text": ", "
                    },
                    {
                        "type": "text",
                        "marks": [
                            {
                                "type": "link",
                                "attrs": {
                                    "href": "https://matrix.org",
                                    "title": null
                                }
                            }
                        ],
                        "text": "links"
                    },
                    {
                        "type": "text",
                        "text": ", "
                    },
                    {
                        "type": "text",
                        "marks": [
                            {
                                "type": "code"
                            }
                        ],
                        "text": "code"
                    },
                    {
                        "type": "text",
                        "text": ", and images."
                    }
                ]
            },
            {
                "type": "paragraph",
                "content": [
                    {
                        "type": "text",
                        "text": "Block elements are also supported, including:"
                    }
                ]
            },
            {
                "type": "bullet_list",
                "content": [
                    {
                        "type": "list_item",
                        "content": [
                            {
                                "type": "text",
                                "text": "headings"
                            }
                        ]
                    },
                    {
                        "type": "list_item",
                        "content": [
                            {
                                "type": "text",
                                "text": "code blocks"
                            }
                        ]
                    },
                    {
                        "type": "list_item",
                        "content": [
                            {
                                "type": "text",
                                "text": "blockquotes"
                            }
                        ]
                    },
                    {
                        "type": "list_item",
                        "content": [
                            {
                                "type": "text",
                                "text": "lists"
                            }
                        ]
                    }
                ]
            }
        ]
    }
}
```

The marks (used for styling, links, etc.) are stored in the marked nodes, similar to the internal model used in many editors. This does create some [challenges](https://www.inkandswitch.com/peritext/#format-spans-in-a-json-document) for collaboration algorithms, which may need e.g. atomic move support to ensure concurrent marks don't duplicate content. Some designs avoid this by storing marks separately (in the style of [AtJSON](https://github.com/CondeNast/atjson)), but this would require defining a single way to identify document locations. Since location identifiers are a major area of ongoing innovation in collaboration algorithms, it seems best to avoid such a constraint. With all that in mind, this design seems best for its conceptual simplicity which avoids the need for algorithm-specifics (like mark locations) in the document format.

If there are two adjacent nodes with the same marks and attributes, they must be combined. This ensures there is only one way to represent a given document.

There is no need or requirement to store the entire document in a single event, and for large documents, the [event size limit (64 KiB)](https://spec.matrix.org/unstable/client-server-api/#size-limits) would prevent that anyway.

Documents can be modified via [changes](#Collaborative-changes), and this mechanism can be leveraged to build a up large document in several steps.

For cases where you do need to store a large document in one step, upload the document contents to the media repository and replace it with the returned MXC URI.

```json
{
    "type": "m.document",
    "content": {
        "schema": "#basicmark:example.com@1.0.0",
        "content": "mxc://example.com/ldwwpduyuk"
    }
}
```

## Schema

A document schema describes the abstract syntax tree (AST) of the document, so that all programs have a shared understanding of how document nodes fit togther, what attributes they have, etc. Documents and changes to those documents are described in terms of the schema's nodes and marks, so all programs accessing a document will need to understand its schema. 

Parsing and serialisation semantics to and from some UI layer are explicitly not defined, as this is platform dependent.

Schemas are stored as events in a room, which SHOULD be a public, world-readable room for ease of access.

A schema has a `version` field to allow for evolution over time. 

When referencing a schema from a document event:

* `#basicmark:example.com@1.0.0` means "the `m.document.schema` event in room `#basicmark:example.com` with version `1.0.0`"
* `#basicmark:example.com` without a version specifier means "the latest `m.document.schema` event in room `#basicmark:example.com`"

### Nodes

Each type of node has an entry in `nodes`. The key for each entry is the node type.

If a node type can contain child nodes, it must have a `content` field with a [content expression](https://prosemirror.net/docs/guide/#schema.content_expressions) declaring the type and amount of valid child nodes.

A node type with an optional `group` field adds that type to a set of types which can be referenced in content expressions.

Node types which are text (or can be placed alongside text) must have `inline: true`.

Node types may specify allowed mark types with an optional `marks` expression. Inline nodes default to allowing all marks, and block node default to no marks. Use `"*"` to indicate all marks and `""` for no marks.

### Marks

Marks denote various embellishments and annotations applied to a portion of a document, such as styling, links, etc.

Similar to node types, each type of mark has an entry in `marks`. The key for each entry is the mark type.

A mark type with an optional `group` field adds that type to a set of types which can be referenced in mark expressions.

The optional `before` field (defaults to `false`) sets whether the mark is considered active when a cursor is positioned _before_ the start of the mark. 

The optional `after` field (defaults to `true`) sets whether the mark is considered active when a cursor is positioned _after_ the end of the mark.

The `before` and `after` fields control whether marks expand when additional content is added at the edges. The defaults [match](https://www.inkandswitch.com/peritext/#example-8) the behaviour of styling marks in most text editors. However, links are often treated tightly bound to their content, so link-like marks should set `after: false`.

### Attributes

Node and mark types can also have attributes. If a type has attributes, it must have an `attrs` object.

Each allowed attribute has an entry in the `attrs` object. The key for each entry in the attribute type.

Attributes can optionally specify a `default` field to define a value when no explicit value is given.

> ⚠️ The following schema is a random example. It is not attempting to replicate any existing document schema.

```json
{
    "type": "m.document.schema",
    "content": {
        "version": "1.0.0"
        "nodes": {
            "doc": {
                "content": "block+"
            },
            "paragraph": {
                "content": "inline*",
                "group": "block"
            },
            "blockquote": {
                "content": "block+",
                "group": "block"
            },
            "horizontal_rule": {
                "group": "block"
            },
            "heading": {
                "attrs": {
                    "level": {
                        "default": 1
                    }
                },
                "content": "inline*",
                "group": "block"
            },
            "code_block": {
                "content": "text*",
                "group": "block",
                "marks": "",
            },
            "text": {
                "group": "inline"
            },
            "image": {
                "attrs": {
                    "src": {},
                    "alt": {
                        "default": null
                    },
                    "title": {
                        "default": null
                    }
                },
                "inline": true,
                "group": "inline"
            },
            "hard_break": {
                "inline": true,
                "group": "inline"
            }
        },
        "marks": {
            "link": {
                "attrs": {
                    "href": {},
                    "title": {
                        "default": null
                    }
                },
                "after": false,
            },
            "em": {},
            "strong": {},
            "code": {}
        }
    }
}
```

## Changes

In a collaborative environment, multiple users may edit the document at different times, potentially without network access.

To support this workflow while still presenting the same content to all users, we need to carefully capture the intent of each change such that multiple timelines can be merged in a sensible way using various algorithms, such as [CRDTs](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type) (see [related work](#CRDTs)) or other collaborative approaches.

In this proposal, we avoid choosing a specific collaborative algorithm, as this is a rapidly changing field, and it would be unwise to attempt to bake a single algorithm into Matrix. Instead, we describe a generic syntax for capturing user intent which is sufficient to drive many different algorithms.

The syntax used here aims to balance several goals:

* captures user intent
* human-readable (no opaque binary blobs)
* compact where convenient (strings and tree fragments instead of single characters)

Performance, while of course important, is *not* an explicit goal here. It is common for collaboration libraries to compare performance benchmarks, but many real-world documents are actually fairly short with a reasonable number of changes, so performance hazards at the limit are not the primary focus of this proposal.

### Syntax

```json
{
    "type": "m.document.change",
    "content": {
        "algorithm": "com.example.magic",
        "device_id": "EGHYCQRQXH",
        "operation": "insert", // algorithm-defined string
        "position": { // algorithm-defined value
            "type": "before",
            "change_id": "<a previous change / document event ID>"
        }, 
        "content": [ // algorithm-defined value (optional)
            {
                "type": "text",
                "text": "Hello Matrix!"
            }
        ], 
    }
}
```

`algorithm` identifies the collaboration semantics used in this change.

The sender's `device_id` is included to distinguish device streams as explained in [ordering](#Ordering) below.

`operation` is some string identifying the change operation, such as "insert", "remove", etc. The set of valid strings is defined by the algorithm.

`position` specifies "where" the operation happens. The type and meaning of this value is defined by the algorithm. It may be any valid JSON type, e.g. a string, number, object with fields, etc. While specifying positions may seem simple at first glance, it is actually one of the [more complex](https://mattweidner.com/2022/02/10/collaborative-data-design.html#principle-2) aspects of algorithm design and approaches vary widely, so it is best to offer maximal freedom here. For algorithms that position relative to previous operation IDs, it is likely best to instead use Matrix event IDs when adapting them for this context.

`content` specifies "what" the operation does. The type and meaning of this value is defined by the algorithm. It may be any valid JSON type, e.g. a string, number, object with fields, etc. For example, when changing marks, it could the string name of the mark. When inserting additional content, it may be one or more tree fragments matching the schema. All algorithms MUST use human-readable strings or tree fragments which conform to a valid subset of the document's schema for additive operations. This field is optional, since only some operations have content.

### Ordering

Similar to [sending regular room messages](https://spec.matrix.org/v1.2/client-server-api/#recommendations-when-sending-messages), clients MUST queue change events per room to ensure they are sent in the order they were created on that device.

As each device is potentially a seperate editing session, the sender's device ID is included in the message.

With these two concepts in mind, the standard Matrix event semantics are sufficient to give a [causally ordered](https://mattweidner.com/2022/02/10/collaborative-data-design.html#causal-order) stream for each `(user_id, device_id)` pair. Events from the *same* stream are available to all clients in the order they were created. Events from *different* streams can appear in any possible relative ordering.

Collaboration algorithms often operate by recreating document tree changes and merging them deterministically, which contrasts with the standard Matrix handling of chat messages, where clients are presented with a linear view.

### Example

While specific algorithms are beyond the scope of this proposal, an [example algorithm](saguaro.md) (WIP) shows one possible approach.

## Snapshots

As a document evolves over time, there may be many thousands of events that compose together to form the current contents. Forcing this full history to be loaded on each view would be a poor experience, so editors can emit occasional snapshots as state events.

```json
{
    "type": "m.document",
    "state_key": "latest",
    "content": {
        "m.relates_to": {
            "rel_type": "m.document.snapshot",
            "event_id": "<last change event ID seen by sending session>"
        },
        ... content from document ...
    }
}
```

* [ ] What should happen above the event size limit? Perhaps send the contents to the media repo and reference the MXC URI?
* [ ] Is more metadata beyond one session's last seen change ID needed to make this useful? Perhaps a map with the last seen change event ID for each `(user_id, device_id)` pair that ever sent a change event?

## Future extensions

Various future building blocks may build on top the base scheme outlined above. Basic details of some potential extensions are sketched below to give an idea of those concepts may can work together with the overall design.

### Editors (future)

Document editors can be added to rooms as widgets, and that may be the main way they are accessed initially, but this is somewhat limiting, as managing widgets requires special permission in a room, so it is not easy to use your favourite editor for a given document type.

Clients could store knowledge of document editors you have encountered and the document types they support. From there, they could allow users to set their preferred editor for a given document type, and then always open such documents in that editor, matching similar user preferences from desktop operating systems.

### Exports (future)

When an editor is first added to a room, it can add a state event declaring the export formats it supports.

```json
{
    "type": "m.document.export",
    "state_key": "com.example.editor",
    "content": {
        "formats": [
            "text/html"
            "application/pdf",
            "application/vnd.oasis.opendocument.text"
        ],
    }
}
```

* [ ] Mention possible request / reply system to ask for an export outside of editor UI
* [ ] Perhaps export content to the room using extensible events syntax

### Bundles (future)

* [ ] Consider how to represent multi-file bundles like ODF, OOXML, etc.

### User awareness (future)

Temporary editor state that is not part of the document proper, e.g. per-user cursor position, selection state, etc.

* Custom EDUs perhaps
* These features are highly workflow dependent
    * Sometimes critical to e.g. follow the presenter's cursor 
    * Other times quite distracting and creepy when trying to read or update a shared document that others happen to be viewing at the same time

## Potential issues

The collaboration approach described here attempts to include enough information about what the user changed so that various different collaboration algorithms can be used. It is possible that the semantics are insufficiently generic to support all desirable collaboration algorithms. It would be best to have examples of using this messaging syntax with at least 2 such algorithms to increase confidence in the design.

## Alternatives

The space of design choices here is very broad, so there are many possible alternative along various dimensions.

### Specific collaboration algorithm

Instead of trying to be so generic, this could instead be built around a single existing collaboration algorithm. 

While that is perhaps simpler to achieve and may use more compact messages, the collaboration field is rapidly growing, with new algorithms appearing regularly, so it would seem unwise to attempt to bless a single one for Matrix at this time.

### Server-assisted collaboration

The approach described here requires each program that wants to collaborate (usually editor widgets) to have an implementation of this syntax and the matching collaboration algorithm.

The collaboration logic could instead be embedded in the homeserver which would expose a much simpler object store to those programs, similar in some ways to state resolution today.

While it sounds great to magically offer collaboration to all API clients, this would mean not only selecting or crafting a single collaboration approach, but also baking that into each homeserver. This seems like a risky gamble when the collaboration field is still churning out new designs regularly.

## Security considerations

Storing documents within a Matrix room is a large security improvement compared to out-of-band storage on third-party servers (e.g. various cloud office solutions).

## Related work

The ideas here are most directly influenced by [ProseMirror](https://prosemirror.net), [Peritext](https://www.inkandswitch.com/peritext), and Matthew Weidner's [CRDT design guide](https://mattweidner.com/2022/02/10/collaborative-data-design.html). These and many other related resources are collected below.

### Matrix

#### Events

* [Compound Matrix events](/X8K4WF9NRWys2ipiOI1I_Q)
* [MSC1767: Extensible events](https://github.com/matrix-org/matrix-doc/pull/1767)
* [MSC3551: Files as extensible events](https://github.com/matrix-org/matrix-doc/pull/3551)
* [MSC3089: File tree structures](https://github.com/matrix-org/matrix-doc/pull/3089)
* [MSC2477: Custom EDUs](https://github.com/matrix-org/matrix-doc/pull/2477)

#### Ordering

* [Event ordering](https://github.com/matrix-org/matrix-spec/issues/852)

### Editors

* [ProseMirror](https://prosemirror.net)

### CRDTs

#### Principles

* [Designing Data Structures for Collaborative Apps](https://mattweidner.com/2022/02/10/collaborative-data-design.html)

#### Algorithms and implementations

* [Peritext](https://www.inkandswitch.com/peritext)
* [Collabs](https://github.com/composablesys/collabs)
* [Automerge](https://github.com/automerge/automerge)
* [Yjs](https://github.com/yjs/yjs)
* [Chronofold](https://arxiv.org/abs/2002.09511)

### Annotated strings

* [AtJSON](https://github.com/CondeNast/atjson)
* [Apple's AttributedString](https://developer.apple.com/documentation/foundation/attributedstring)

### Computational media

* [Webstrates](https://webstrates.net/)
