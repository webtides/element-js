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
## [0.6.1] - 2022-11-18

### FIXED
* Store always switching to singleProperty Mode if constructed without any arguments.    

### ADDED
* Store watch() map to control internal store state scope

## [0.6.0] - 2022-11-17

### ADDED
* StoreProperty for shared application state  
* Directives for Vanilla Renderer

## [0.5.0] - 2022-09-13

### Changed
* improved the performance of the vanilla-renderer

### Removed
* setting attributes as properties during dom diffing for the vanilla renderer. This is potentially a **breaking** change if you used attributes with the "." (dot) notation

## [0.4.3] - 2022-07-06

### ADDED
* parse option to propertyOptions that can be either a boolean OR a function for custom parsing
* enhance reflect option in propertyOptions that it can also be a function for custom reflection

## [0.4.2] - 2022-02-03

### Fixed
* vanilla-renderer: fixes attribute comparsion

## [0.4.1] - 2022-02-01

### Fixed
* refs="id[]" indexing keys not nodes *rolleyes* 

### Added
* refs="id[]" aka possibbility to refrence a list of nodes to the $refs map. 

## [0.4.0] - 2022-01-28

### Added
* a "vanilla" renderer with support for hydration and no dependencies

### Changed
* uses new @web/test-runner isntead of karma (#27)

## [0.3.3] - 2021-09-22

### Added
* optional complex event callback notation to support addEventListener options (i.E. for passive Event Listeners )
* Example:  {listener: () => {}, options: { passive: true } }
* docs
* tests


## [0.3.2] - 2021-03-09

### Added
* bundled version of `element-js` to use from a CDN and be able to prototype in tools like CodePen etc.

## [0.3.1] - 2020-12-08

### Fixed 
* i18n fallback values

### Added
* i18n tests

## [0.3.0] - 2020-07-27

### Added
* first batch/draft of the documentation
* property/attribute reflection via constructor options (see the [Documentation](/docs/README.md#propertyoptions) for more info)
* mutationObserverOptions to enable observing subtree mutations (see the [Documentation](/docs/README.md#mutationobserveroptions) for more info)

### Removed
* `childListUpdate` constructor option has been deprecated and will be removed before `1.0`

## [0.2.0] - 2020-07-01

### Changed
* uses shady-render instead of render from `lit-html` for rendering templates to be compatible with the shady-css polyfill
* refactored and simplified `StyledElement`s handling/loading of style sheets

## [0.1.0] - 2020-06-26

* initial release
