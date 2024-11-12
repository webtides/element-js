// TODO: for testing that SSR and CSR will render the same thing, it would be good to test with whitespace and comment markers to make sure that they perfectly match!
// TODO renderer should actually not output any blanks and whitespaces that have to be removed for testing ...
export const stripCommentMarkers = (html) =>
    html
        .replace(/<!--(\/)?(dom|template)-part(-\d+)?(\?.*?)?-->/g, '')
        .replace(/\s+/g, ' ')
        .replaceAll(' >', '>')
        .replaceAll('> ', '>')
        .trim();

export const stripWhitespace = (html) => html.replace(/\s+/g, ' ').replaceAll('> <', '><').trim();
