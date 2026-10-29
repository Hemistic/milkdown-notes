import { syntaxHighlighting } from '@codemirror/language';
import { classHighlighter } from '@lezer/highlight';

export const noteCodeHighlight = syntaxHighlighting(classHighlighter);
