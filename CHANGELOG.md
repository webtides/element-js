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
