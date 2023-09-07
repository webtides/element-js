# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

<!--
   PRs should document their user-visible changes (if any) in the
   Unreleased section, uncommenting the header as necessary.
-->

<!-- ## Unreleased -->
<!-- ### Added -->
<!-- ### Changed -->
<!-- ### Removed -->
<!-- ### Fixed -->

## [1.0.0-alpha.3] - 2023-??-??

### Changed

- _BRAKING_ Changed the default options when using the `dispatch` helper function. `bubbles`, `cancelable` and `composed` will now be `true` by default.
- _BRAKING_ Changed adopting global styles to include ALL global styles. Previously only one inline <style> with the ID of '#globalStyles' would be adopted. For more information see the docs. 

### Removed

-   _BRAKING_ Removed `i18n` helper function. See CHANGELOG how to implement it yourself or use a third party library.

## [1.0.0-alpha.2] - 2023-08-23

### Added

-   Added JSDocs for everything in the codebase. This will especially be helpful when using constructor options.

## [1.0.0-alpha.1] - 2023-08-15

### Added

-   Added our own versions of directives and template helpers ([#67](https://github.com/webtides/element-js/pull/67))

### Changed

-   _BRAKING_ Uses a new custom renderer for the `TemplateElement`. It replaces the old `lit-html` renderer. The API and usage should be exactly the same. The only thing to do/change is the use of the old `lit-html` directives. For detailed instructions see the upgrade guide. ([#67](https://github.com/webtides/element-js/pull/67))
-   _BREAKING_ `element-js` will now also trigger the `afterUpdate` hook right after the `connected` hook. This is to reduce the cases where you had to do the same things in `connected` and `afterUpdate`. You can now remove those duplicate calls from the `connected` hook. ([#60](https://github.com/webtides/element-js/pull/60))
-   _BREAKING_ Changed `package.json` type to `module`. This should hopefully not break anything. `element-js` is either used directly from the browser or through a bundler. In both cases the added type: module should not matter. ([#64](https://github.com/webtides/element-js/pull/64))

### Removed

-   _BREAKING_ Removed the `lit-html` dependency. `element-js` is now officially dependency free! ([#67](https://github.com/webtides/element-js/pull/67))
-   _BREAKING_ Removed the deprecated `BaseElement` constructor option `childListUpdate`. Please use the "mutationObserverOptions" dictionary instead. See the docs for more info. ([#99](https://github.com/webtides/element-js/pull/99))
-   _BREAKING_ Removed the `hooks` map in the `BaseElement`. Using the hooks() map for lifecycle hooks is deprecated! Please overwrite the existing lifecycle hook functions. See the docs for more info. ([#99](https://github.com/webtides/element-js/pull/99))
-   _BREAKING_ Removed the `computed` map in the `BaseElement`. Using the computed() map for computed properties is deprecated! Please use regular JS getters and return the computed value. See the docs for more info. ([#99](https://github.com/webtides/element-js/pull/99))
-   _BREAKING_ Removed all occurrences of `ShadyCSS` in `StyledElement`. ([#99](https://github.com/webtides/element-js/pull/99))

## [0.7.3] - 2023-03-07

### Fixed

-   last release was tagged wrong

## [0.7.2] - 2023-03-03

### Fixed

-   watcher callbacks for injected stores

## [0.7.1] - 2023-03-03

### Added

-   Elements are now able to watch Stores

### Fixed

-   Injection of falsy values

## [0.7.0] - 2023-02-13

### Added

-   Dependency Injection via Context Protocol 💉
-   Provide reactive Properties or entire Stores via: provideProperties() { return { name : value}}
-   Inject / Request them via injectProperties() { return { name : 'defaultValue'}}

### Changed

-   docs structure

### Fixed

-   Cannot re-render slotted light dom when using the vanilla renderer https://github.com/webtides/element-js/issues/76
-   adds Vanilla Renderer Tests

## [0.6.2] - 2022-11-18

### FIXED

-   Store always switching to singleProperty Mode if constructed without any arguments.

## [0.6.1] - 2022-11-18

### ADDED

-   Store watch() map to control internal store state scope

## [0.6.0] - 2022-11-17

### ADDED

-   StoreProperty for shared application state
-   Directives for Vanilla Renderer

## [0.5.0] - 2022-09-13

### Changed

-   improved the performance of the vanilla-renderer

### Removed

-   setting attributes as properties during dom diffing for the vanilla renderer. This is potentially a **breaking** change if you used attributes with the "." (dot) notation

## [0.4.3] - 2022-07-06

### ADDED

-   parse option to propertyOptions that can be either a boolean OR a function for custom parsing
-   enhance reflect option in propertyOptions that it can also be a function for custom reflection

## [0.4.2] - 2022-02-03

### Fixed

-   vanilla-renderer: fixes attribute comparsion

## [0.4.1] - 2022-02-01

### Fixed

-   refs="id[]" indexing keys not nodes _rolleyes_

### Added

-   refs="id[]" aka possibbility to refrence a list of nodes to the $refs map.

## [0.4.0] - 2022-01-28

### Added

-   a "vanilla" renderer with support for hydration and no dependencies

### Changed

-   uses new @web/test-runner isntead of karma (#27)

## [0.3.3] - 2021-09-22

### Added

-   optional complex event callback notation to support addEventListener options (i.E. for passive Event Listeners )
-   Example: {listener: () => {}, options: { passive: true } }
-   docs
-   tests

## [0.3.2] - 2021-03-09

### Added

-   bundled version of `element-js` to use from a CDN and be able to prototype in tools like CodePen etc.

## [0.3.1] - 2020-12-08

### Fixed

-   i18n fallback values

### Added

-   i18n tests

## [0.3.0] - 2020-07-27

### Added

-   first batch/draft of the documentation
-   property/attribute reflection via constructor options (see the [Documentation](/docs/README.md#propertyoptions) for more info)
-   mutationObserverOptions to enable observing subtree mutations (see the [Documentation](/docs/README.md#mutationobserveroptions) for more info)

### Removed

-   `childListUpdate` constructor option has been deprecated and will be removed before `1.0`

## [0.2.0] - 2020-07-01

### Changed

-   uses shady-render instead of render from `lit-html` for rendering templates to be compatible with the shady-css polyfill
-   refactored and simplified `StyledElement`s handling/loading of style sheets

## [0.1.0] - 2020-06-26

-   initial release
