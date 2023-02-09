
### Reactivity

_element-js_ elements update asynchronously when attributes or reactive properties are changed. Changes will also be
batched if multiple updates occur. The update itself will always happen in the following frame.

An update lifecycle roughly looks like this:

1. A property is changed
2. Check whether the value actually changed and if so, request an update
3. Requested updates are batched in a queue
4. Perform the update in the next frame
5. Trigger Watchers for properties if defined
6. Render the template if defined
