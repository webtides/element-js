# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres
to [Semantic Versioning](http://semver.org/).

<!--
   PRs should document their user-visible changes (if any) in the
   Unreleased section, uncommenting the header as necessary.
-->

<!-- ## Unreleased -->
<!-- ### Added -->
<!-- ### Changed -->
<!-- ### Removed -->
<!-- ### Fixed -->

## Unreleased

### ADDED

- #119 a pushed `v*` tag creates the GitHub release after the npm publish, the release notes are the changelog section of the version followed by the generated pull request list. The publish stops when the tag does not match the version in `package.json`.

### CHANGED

- #184 one description of every binding for client rendering, hydration and `toString()`. The template literal is parsed once into descriptors (`src/dom-parts/parseTemplate.js`), the DOM parts and the server side writer are built from the same descriptors and apply the same rules (`src/dom-parts/values.js`). A rule changes in one place now.
- #184 the markers in the markup carry only what hydration needs: `<!--t:HASH-->` and `<!--/t-->` around a template instance, with a hash of the literal, `<!--N-->` and `<!--/N-->` around a child node value, and one `<!--N-->` in front of an element with attribute, text or directive bindings, `N` being the index of the first value. The attribute name, the static text and the kind of a binding are no longer written into the markup, a raw text element no longer repeats its whole content in a comment per interpolation. **Server markup of an earlier version does not hydrate** with this version, the element renders client side with a warning. Server and client have to move to this version together, `@webtides/element-js-ssr-renderer` picks the format up through `toString()`.
- #184 the client clone is the markup of the literal as written, the parser no longer inserts line breaks around elements. Templates without whitespace between an interpolation and an element render without whitespace there. Static attributes keep their spelling and quotes, only the whitespace in front of a closing bracket goes and a self closed element gets its end tag.
- #184 the hash is checked once per template instance on hydration, instead of comparing the descriptor of every marker
- #184 an attribute with several interpolations is one binding with the static pieces between them, its part joins the string and writes it when it changed. The same goes for the content of a raw text element.
- #184 the parser rejects a template at parse time whose interpolations cannot be bound: a boolean, property or event binding that is not the whole attribute value, an interpolation in a comment, in a tag name or in an attribute name. Before, such templates were silently stringified or produced broken markup.
- `toString()` writes every bound attribute with double quotes, whatever quotes the literal uses, and leaves no stray whitespace in a tag where a bound attribute or a directive was left out
- an object or array in an attribute binding is written as JSON on the client too, like `toString()` and the attribute reflection do, instead of `[object Object]`
- `null` and `undefined` among several interpolations of an attribute write nothing instead of the strings "null" and "undefined", client side and in `toString()`
- a boolean attribute binding treats the string "false" as false in `toString()` too, like the client does
- the hydrate flag is gone from the part API: a child node part knows from its binding whether it hydrates, nested parts bind to the server rendered markers on their first update
- an array value is written in two passes: every position gets its item, the template part, text node or node, then one cursor walk brings the DOM in line with the items. A node that stays in place is never touched. Before, an update walked the items five times
- a template instance and an array item are the nodes between their markers, the renderer keeps no lists of rendered nodes. A child node part that switches from a template to another value and back renders the template fresh
- `unsafeHTML()` returns a plain object that carries the string, on the client as well, instead of a function that parses it. The child node part parses the string once per value. Code that called the returned function has to put the value into a template instead
- `TemplateResult.toString()` joins the static segments of the literal with the written values, instead of running a regular expression replace over the whole template per call
- `RawTextNodePart` is `TextContentPart`, `NodePart` is `DirectivePart`, `AttributePart` takes an element and a descriptor. Parts get all values of the template in `update(values)` and read their own by index. The parts on an element extend `ElementPart` (`src/dom-parts/ElementPart.js`), which reads the DOM once before the first write and writes only a change: `AttributePart`, `BooleanAttributePart`, `PropertyPart`, `EventPart`, `OnEventPart`, `TextContentPart` and `DirectivePart`. The `Part` base class is gone, `ChildNodePart` and `TemplatePart` stand on their own

### FIXED

- #184 `toString()` wrote the content of `<style>` and `<script>` HTML encoded, `.a > .b` became `.a &gt; .b` in the delivered CSS and only hydration repaired it. The content of `<style>` and `<script>` is written as is, a value that contains the end tag of the element throws. `<textarea>` and `<title>` stay encoded, the parser decodes them
- #185 every `<style>`, `<script>`, `<textarea>` and `<title>` with interpolations gets its raw text part, not only the first one of a template, and an interpolation after a line break inside such an element is found as well
- a raw text element with one interpolation and static text around it, `<style>.a { color: ${color}; }</style>`, keeps the static text. Client side and on hydration the whole content was replaced by the value
- a raw text end tag with whitespace before its closing bracket, `</style\n>` as a formatter writes it, is recognised
- `isOfSameNodeType()` returns false for a missing node instead of throwing

### CHANGED

- #187 the nodes between two markers are removed walking forward from the start marker, without collecting them backwards into a list first, clearing a long list is no longer slower than creating it
- an array that shrinks releases the template parts of the items that are gone, they are no longer kept for a later growth
- `unsafeHTML()` parses its string on the first render only, a render with the same string leaves the DOM alone without parsing
- a child node part creates its text node when the first string arrives, parts that only render templates have none
- `TemplateResult` throws `ParseTemplateError` instances, an `Error` subclass with a `details` property, instead of plain objects
- `toString()` warns when it writes an object as text
- `render()` recognises a node whose content was replaced from outside, by `innerHTML` or by a string rendered in between, and renders fresh instead of updating the detached instance

### REMOVED

- `TemplateResult.parseParts()`, `TemplateResult.parseSSRUpdates()` and `createTemplateString()`, replaced by `parseTemplate()` in `src/dom-parts/parseTemplate.js`, which returns the descriptors, the client markup and the server segments of a literal
- `src/dom-parts/RawTextNodePart.js` and `src/dom-parts/NodePart.js`, see `TextContentPart.js` and `DirectivePart.js`. `src/dom-parts/PartMarkers.js` and `src/dom-parts/Part.js`, a template instance and a child node part know their start and end marker themselves
- `TemplateResult.templateString`, the client markup of a literal is `parseTemplate(strings).clientHtml`
- the DOM diffing helpers of the renderer before the dom-parts, `diffNodes`, `diffAttributes`, `hasChildNodes`, `getNodePath` and `decodeHTML` in `src/util/DOMHelper.js`, nothing in the library uses them. A project that imported them through `./src/util/DOMHelper.js` has to copy them.

## [1.3.0] - 2026-10-28

### ADDED

- renderer benchmark in `benchmark/`: `npm run bench` measures `render()` headless on a js-framework-benchmark style table with that benchmark's operation set plus hydration, `npm run bench:compare` measures `main` right after it on the same machine and flags deviations, `--base <ref>` compares against any commit, `--micro` includes the part binding strategies. Every operation has a post-condition on the DOM, a measurement whose post-condition fails is reported as invalid. See `benchmark/README.md`.
- the benchmark runs on every pull request, measures the base commit in the same job and posts the report as a sticky comment on the pull request. Tests and benchmark run for pull requests against any branch, not only `main`.
- `examples/showcase/` walks through every documented feature, one section per docs chapter. `examples/hydration/` plays hydration through with a mutation log: server markup, hydration and the updates afterwards. `examples/index.html` links all example pages.

### FIXED

- #168 hydrated templates bind their parts to the server rendered DOM. Updates after hydration reach attributes, text, child nodes and lists. The first client values go through the normal update, server rendered templates, lists, text nodes and attributes that match are left untouched.
- #115 hydration does not depend on the whitespace around the markers anymore.
- arrays are synced by walking the live DOM instead of an index snapshot: hydrated templates survive other items the server rendered around them, array items whose server markers do not match are rendered client side, DOM nodes in arrays can be reordered, and list updates got considerably faster.
- a nested template at the root of a template no longer confuses the marker lookup (`PartMarkers.createFromStartNode` is nesting aware)
- #172 arrays nested in an array are rendered flat, like the server renders them, client side and on hydration
- #173 functions as array items are resolved completely, a function that returns a template or another function works like a function as a single value
- #157 an array item that switches to a different template, or between a text and a template, is rendered fresh at its index, also after the array shrank and grew again. `null` and `undefined` items of an array render nothing, like on the server
- #167 `toString()` leaves out an attribute whose value is `null` or `undefined`, like the DOM renderer removes it. An attribute with several interpolations keeps writing every value as text
- #169 `toString()` writes a camelCase property binding as the dash-case attribute that maps back to the property on upgrade, `.sliderOptions` becomes `slider-options`
- #163 an attribute whose name starts with "on" is written as an attribute when its value is not a function, so `on="${state}"` or `once="${flag}"` work on an element. A function is the "old school" event listener, client side and in `toString()`
- #174 a declarative shadow root (`<template shadowrootmode>`) gets the element styles and the global styles adopted on the first render and follows global style changes
- a global style that is added in the same mutation batch as other DOM changes is adopted, the global styles store looks at every record of a batch
- #121 the custom directive example in the templates docs is a `Directive` class wrapped with `defineDirective()`, a plain function does not work at that position

### CHANGED

- parts are bound by walking the comment markers with a TreeWalker instead of precomputed node paths, for client renders and hydration alike. Part construction no longer renders, values only flow through `update()`, hydration is the first update with a `hydrate` flag. This removes the double diffing on first render.
- `TemplateResult.parseParts()` returns the part descriptors without `path`
- `?attribute` bindings write `name=""` for true also when the attribute is present with another value, for example a reflected `name="false"` in server rendered markup, and remove the attribute for false and the string `'false'`
- server rendered markers that do not match the template are reported with `console.warn` and the template is rendered client side instead

## [1.2.12] - 2026-04-21

### FIXED
- nullpointer in GlobalStyleStore due to undefined ownerNodes (in safari)

## [1.2.11] - 2026-04-21

### FIXED
- github / npm publish action
- npm pkg fix

### CHANGED
- bump node versions in pipelines to lts

## [1.2.7] - 2026-04-17

### ADDED
- Added a new connected-context example to demonstrate late context provisioning.
- Added composed DOM child traversal so both light DOM and shadow DOM children are considered.

### FIXED
- Improved context verification to handle late-connected providers more reliably.
- Updated shadow-context handling and related tests.

## [1.2.6] - 2025-10-27

### FIXED
- #158 keep state when elements get removed from dom (by the renderer) but take care that state gets properly setup after reconnect
- #161 attach shadow roots and render in the very same tick to prevent race conditions when adopting styles

## [1.2.5] - 2025-09-03

### FIXED

- #159 changes from 1.2.4 were checked too loose and were not recreating reactivee properties in some cases / races 


## [1.2.4] - 2025-09-03

### FIXED

- #159 fixes element cleanup on disconnect. 

### CHANGED

- remove refs, state and pending update on disconnectedCallback



## [1.2.3] - 2025-08-26

### FIXED

- Fixes a bug where event listeners were not unregistered from detached (conditionally rendered) dom elements. The Bug led to event listeners being registered with every update.

## [1.2.1] - 2025-08-21

### FIXED

- Fixes attribute interpolation Error where values contained "=" chars ([#154](https://github.com/webtides/element-js/issues/154))


## [1.2.0] - 2025-06-13

### ADDED

- Added custom "connected" CSS :state() to all base elements once connected ([#151](https://github.com/webtides/element-js/issues/151))

### FIXED

- Fixed global style store not caching style sheet entries ([#152](https://github.com/webtides/element-js/pull/152))

## [1.1.8] - 2025-04-09

### FIXED

- Fixed conditional rendering of templates and arrays and any other types ([#149](https://github.com/webtides/element-js/pull/149))

## [1.1.7] - 2025-02-17

### FIXED

- Fixed double diffing of template results ([#148](https://github.com/webtides/element-js/pull/148))
- Fixed diffing arrays of template results and re-rendering between array parts and other parts ([#146](https://github.com/webtides/element-js/pull/146))

## [1.1.6] - 2025-01-23

### FIXED

- Fixed diffing arrays of template results and re-rendering between array parts and other parts ([#145](https://github.com/webtides/element-js/pull/145))
- Fixed re-rendering between static strings and dynamic html ([#141](https://github.com/webtides/element-js/pull/141))

## [1.1.5] - 2024-11-14

### FIXED

- Fixed using special characters in attribute static strings ([#134](https://github.com/webtides/element-js/issues/134))

## [1.1.4] - 2024-11-12

### FIXED

- Fixed rendering interpolations inside textarea nodes ([#133](https://github.com/webtides/element-js/issues/133))

## [1.1.3] - 2024-11-11

### FIXED

- Fixed unsafeHtml having more than one child ([#135](https://github.com/webtides/element-js/issues/135))
- Fixed early returns from templates and fixes static html changes not reflecting to DOM ([#132](https://github.com/webtides/element-js/issues/132))


## [1.1.2] - 2024-10-30

### FIXED

- Fixed rerendering of templates that were initially null, prevent runtime errors

## [1.1.1] - 2024-09-16

### FIXED

- Fixed base url and css rules order in adopted style sheets.
- Fixed randomUUID not being available in unsecure hosts (like localhost) by adding a helper function

## [1.1.0] - 2024-06-24

### Added

- Added `optionalAttribute` directive to conditionally render attributes (plus value)

### FIXED

- Fixed `spreadAttributes` to not render "null|undefined|NaN" to the attributes value but removing the entire attribute
  when such values are passed.

## [1.0.0] - 2024-05-24

### Added

- Added our own versions of directives and template helpers ([#67](https://github.com/webtides/element-js/pull/67))
- Added JSDocs for everything in the codebase. This will especially be helpful when using constructor options.
- Added state serialization. This improves hydration from SSR a
  lot. ([#106](https://github.com/webtides/element-js/pull/106))
- added declarative shadow dom rendering for template elements

### Changed

- _BREAKING_ Uses a new custom renderer for the `TemplateElement`. It replaces the old `lit-html` renderer. The API and
  usage should be exactly the same. The only thing to do/change is the use of the old `lit-html` directives. For
  detailed instructions see the upgrade guide. ([#67](https://github.com/webtides/element-js/pull/67))
- _BREAKING_ `element-js` will now also trigger the `afterUpdate` hook right after the `connected` hook. This is to
  reduce the cases where you had to do the same things in `connected` and `afterUpdate`. You can now remove those
  duplicate calls from the `connected` hook. ([#60](https://github.com/webtides/element-js/pull/60))
- _BREAKING_ Changed `package.json` type to `module`. This should hopefully not break anything. `element-js` is either
  used directly from the browser or through a bundler. In both cases the added type: module should not
  matter. ([#64](https://github.com/webtides/element-js/pull/64))
- _BRAKING_ Changed the default options when using the `dispatch` helper function. `bubbles`, `cancelable`
  and `composed` will now be `true` by default.
- _BRAKING_ Changed adopting global styles to include ALL global styles. Previously only one inline <style> with the ID
  of '#globalStyles' would be adopted. For more information see the docs.

### Removed

- _BREAKING_ Removed the `lit-html` dependency. `element-js` is now officially dependency
  free! ([#67](https://github.com/webtides/element-js/pull/67))
- _BREAKING_ Removed the deprecated `BaseElement` constructor option `childListUpdate`. Please use the "
  mutationObserverOptions" dictionary instead. See the docs for more
  info. ([#99](https://github.com/webtides/element-js/pull/99))
- _BREAKING_ Removed the `hooks` map in the `BaseElement`. Using the hooks() map for lifecycle hooks is deprecated!
  Please overwrite the existing lifecycle hook functions. See the docs for more
  info. ([#99](https://github.com/webtides/element-js/pull/99))
- _BREAKING_ Removed the `computed` map in the `BaseElement`. Using the computed() map for computed properties is
  deprecated! Please use regular JS getters and return the computed value. See the docs for more
  info. ([#99](https://github.com/webtides/element-js/pull/99))
- _BREAKING_ Removed all occurrences of `ShadyCSS`
  in `StyledElement`. ([#99](https://github.com/webtides/element-js/pull/99))
- _BRAKING_ Removed the `i18n` helper function. See CHANGELOG how to implement it yourself or use a third party library.

## [1.0.0-alpha.13] - 2024-05-08

### Fixed

- catch security errors when `GlobalStylesStore` tries to read css rules from cross-origin stylesheets.

## [1.0.0-alpha.12] - 2024-03-03

### Added

- added declarative shadow dom rendering for template elements

### Fixed

- fixed issues with whitespace being returned untrimmed in a template result

## [1.0.0-alpha.11] - 2024-03-13

### Fixed

- fixed missing return type `string` for the `template()` function in `TemplateElement`
- fixed types for the `propertyOptions` option in `BaseElement`

## [1.0.0-alpha.10] - 2024-02-20

### Fixed

- fixed unsafeHTML not rendering anything when toString was called
- fixed using = sign in attribute positions with interpolations
- fixed rendering null values in node part positions in SSR
- fixed missing .js file extensions

## [1.0.0-alpha.9] - 2024-01-05

### Changed

- moved DOM methods into connected callbacks to make it safe for the elements to be created in SSR environments

## [1.0.0-alpha.8] - 2024-01-04

### Fixed

- fixed ChildNodePart not replacing dom nodes from unsafeHTML

## [1.0.0-alpha.7] - 2023-12-19

### Fixed

- fixed wrong attribute parts for the same name on different elements

## [1.0.0-alpha.6] - 2023-12-18

### Fixed

- fixed hyphens in attribute names being split in SSR mode

## [1.0.0-alpha.5] - 2023-12-07

### Added

- Added the /docs directory to the files array in package.json
- Added part instances as \_\_part to comment nodes

### Fixed

- fixed escaped unsafeHTML in SSR mode

## [1.0.0-alpha.4] - 2023-12-01

### Fixed

- falsy creation of directive parts for non-directive attributes
- creating parts with wrong comment marker positions

## [1.0.0-alpha.3] - 2023-12-01

### Added

- Added state serialization. This improves hydration from SSR a
  lot. ([#106](https://github.com/webtides/element-js/pull/106))

### Changed

- _BRAKING_ Changed the default options when using the `dispatch` helper function. `bubbles`, `cancelable`
  and `composed` will now be `true` by default.
- _BRAKING_ Changed adopting global styles to include ALL global styles. Previously only one inline <style> with the ID
  of '#globalStyles' would be adopted. For more information see the docs.

### Removed

- _BRAKING_ Removed `i18n` helper function. See CHANGELOG how to implement it yourself or use a third party library.

## [1.0.0-alpha.2] - 2023-08-23

### Added

- Added JSDocs for everything in the codebase. This will especially be helpful when using constructor options.

## [1.0.0-alpha.1] - 2023-08-15

### Added

- Added our own versions of directives and template helpers ([#67](https://github.com/webtides/element-js/pull/67))

### Changed

- _BRAKING_ Uses a new custom renderer for the `TemplateElement`. It replaces the old `lit-html` renderer. The API and
  usage should be exactly the same. The only thing to do/change is the use of the old `lit-html` directives. For
  detailed instructions see the upgrade guide. ([#67](https://github.com/webtides/element-js/pull/67))
- _BREAKING_ `element-js` will now also trigger the `afterUpdate` hook right after the `connected` hook. This is to
  reduce the cases where you had to do the same things in `connected` and `afterUpdate`. You can now remove those
  duplicate calls from the `connected` hook. ([#60](https://github.com/webtides/element-js/pull/60))
- _BREAKING_ Changed `package.json` type to `module`. This should hopefully not break anything. `element-js` is either
  used directly from the browser or through a bundler. In both cases the added type: module should not
  matter. ([#64](https://github.com/webtides/element-js/pull/64))

### Removed

- _BREAKING_ Removed the `lit-html` dependency. `element-js` is now officially dependency
  free! ([#67](https://github.com/webtides/element-js/pull/67))
- _BREAKING_ Removed the deprecated `BaseElement` constructor option `childListUpdate`. Please use the "
  mutationObserverOptions" dictionary instead. See the docs for more
  info. ([#99](https://github.com/webtides/element-js/pull/99))
- _BREAKING_ Removed the `hooks` map in the `BaseElement`. Using the hooks() map for lifecycle hooks is deprecated!
  Please overwrite the existing lifecycle hook functions. See the docs for more
  info. ([#99](https://github.com/webtides/element-js/pull/99))
- _BREAKING_ Removed the `computed` map in the `BaseElement`. Using the computed() map for computed properties is
  deprecated! Please use regular JS getters and return the computed value. See the docs for more
  info. ([#99](https://github.com/webtides/element-js/pull/99))
- _BREAKING_ Removed all occurrences of `ShadyCSS`
  in `StyledElement`. ([#99](https://github.com/webtides/element-js/pull/99))

## [0.7.4] - 2023-11-24

### Added

- storeception (reactive store properties in parent stores)
- context injection in shadow elements requests travel though shadow roots
- defer element connection (disables client side code until called manually)

### Fixed

- late context injection if parent mounts after child (loading order)
- stores updating elements that want to be updated

## [0.7.3] - 2023-03-07

### Fixed

- last release was tagged wrong

## [0.7.2] - 2023-03-03

### Fixed

- watcher callbacks for injected stores

## [0.7.1] - 2023-03-03

### Added

- Elements are now able to watch Stores

### Fixed

- Injection of falsy values

## [0.7.0] - 2023-02-13

### Added

- Dependency Injection via Context Protocol 💉
- Provide reactive Properties or entire Stores via: provideProperties() { return { name : value}}
- Inject / Request them via injectProperties() { return { name : 'defaultValue'}}

### Changed

- docs structure

### Fixed

- Cannot re-render slotted light dom when using the vanilla renderer https://github.com/webtides/element-js/issues/76
- adds Vanilla Renderer Tests

## [0.6.2] - 2022-11-18

### FIXED

- Store always switching to singleProperty Mode if constructed without any arguments.

## [0.6.1] - 2022-11-18

### ADDED

- Store watch() map to control internal store state scope

## [0.6.0] - 2022-11-17

### ADDED

- StoreProperty for shared application state
- Directives for Vanilla Renderer

## [0.5.0] - 2022-09-13

### Changed

- improved the performance of the vanilla-renderer

### Removed

- setting attributes as properties during dom diffing for the vanilla renderer. This is potentially a **breaking**
  change if you used attributes with the "." (dot) notation

## [0.4.3] - 2022-07-06

### ADDED

- parse option to propertyOptions that can be either a boolean OR a function for custom parsing
- enhance reflect option in propertyOptions that it can also be a function for custom reflection

## [0.4.2] - 2022-02-03

### Fixed

- vanilla-renderer: fixes attribute comparsion

## [0.4.1] - 2022-02-01

### Fixed

- refs="id[]" indexing keys not nodes _rolleyes_

### Added

- refs="id[]" aka possibbility to refrence a list of nodes to the $refs map.

## [0.4.0] - 2022-01-28

### Added

- a "vanilla" renderer with support for hydration and no dependencies

### Changed

- uses new @web/test-runner isntead of karma (#27)

## [0.3.3] - 2021-09-22

### Added

- optional complex event callback notation to support addEventListener options (i.E. for passive Event Listeners )
- Example: {listener: () => {}, options: { passive: true } }
- docs
- tests

## [0.3.2] - 2021-03-09

### Added

- bundled version of `element-js` to use from a CDN and be able to prototype in tools like CodePen etc.

## [0.3.1] - 2020-12-08

### Fixed

- i18n fallback values

### Added

- i18n tests

## [0.3.0] - 2020-07-27

### Added

- first batch/draft of the documentation
- property/attribute reflection via constructor options (see the [Documentation](/docs/README.md#propertyoptions) for
  more info)
- mutationObserverOptions to enable observing subtree mutations (see
  the [Documentation](/docs/README.md#mutationobserveroptions) for more info)

### Removed

- `childListUpdate` constructor option has been deprecated and will be removed before `1.0`

## [0.2.0] - 2020-07-01

### Changed

- uses shady-render instead of render from `lit-html` for rendering templates to be compatible with the shady-css
  polyfill
- refactored and simplified `StyledElement`s handling/loading of style sheets

## [0.1.0] - 2020-06-26

- initial release
