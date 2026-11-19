import '@muze-labs/solid-app-data/simply-runtime.mjs';
import { shell } from '@muze-labs/solid-app-ui';
import {
  solidDialog,
  solidListDetails,
  solidToolbar,
  solidDropdown
} from '@muze-labs/solid-design';
import {
  exposeDefinition,
  prepareDefinition
} from '@muze-labs/solid-app-data/definition.mjs';
import {
  StateGraph,
  named,
  xsd,
  literal
} from '@muze-labs/solid-app-data/state-rdf.mjs';
import {
  createSolidMetroClient, loadDocument, valueAt, many
} from '@muze-labs/solid-app-data';
import { readProfile } from '@muze-labs/solid-profile';
import { WorkspaceBroker } from '@muze-labs/solid-app-data/workspace-broker.mjs';
import { local } from '@muze-labs/solid-workspace';
import DOMPurify from 'dompurify';
import {
  AnnotationGroup,
  openGroup,
  saveGroup,
  createGroupDestination,
  doc
} from './annotations.mjs';
import { muzeDocuments } from './features.mjs';
import { muzeDocumentsNavigation } from './navigation.mjs';
import {
  validateFragment,
  readFragment,
  writeFragment,
  cobalt
} from '@muze-labs/solid-app-data/cobalt-fragment.mjs';
import { ReaderState } from './reader-state.mjs';
import readerSource from './reader-state.mjs?source';
import sources from './features.mjs?entries';
import annotationsSource from './annotations.mjs?source';
import pdfSource from './pdf.mjs?source';
import editorSource from './note-editor.mjs?source';
import accountTemplate from './account-view.html?template' with { type: 'text' };

const host = shell({
  acceptLaunch: true,
  embeddedContentOnly: true,
  templates: { account: accountTemplate }
});
const definition = {
  container: host.main.querySelector('[data-documents-app]'),
  components: {
    solidDialog,
    solidListDetails,
    solidToolbar,
    solidDropdown,
    muzeDocuments,
    muzeDocumentsNavigation
  },
  data: {
    muzeDocumentsNavigationPanel: { hidden: '' },
    muzeDocumentsSearchSection: { hidden: null },
    muzeDocumentsBookmarksSection: { hidden: '' },
    muzeDocumentsSearchToggle: { 'aria-expanded': 'false' },
    muzeDocumentsBookmarksToggle: { 'aria-expanded': 'false' },
    muzeDocumentsNavigationMode: 'search',
    muzeDocumentsSearchResults: [],
    muzeDocumentsSearchStatus: '',
    muzeDocumentsBookmarks: [],
    muzeDocumentsBookmarksEmpty: '',
    muzeDocumentsReadingMode: 'continuous',
    muzeDocumentsReadingModes: [],
    muzeDocumentsPreviousTurn: { hidden: '' },
    muzeDocumentsNextTurn: { hidden: '' },
    muzeDocumentsPageLayout: { 'data-reading-mode': 'continuous' },
    muzeDocumentsStatus: '',
    muzeDocumentsHighlightStyles: '',
    muzeDocumentsPages: [],
    muzeDocumentsLocation: '',
    muzeDocumentsSource: { hidden: null },
    muzeDocumentsNotesPanel: { hidden: '' },
    muzeDocumentsNotesToggle: { 'aria-expanded': 'false' },
    muzeDocumentsGroups: [],
    muzeDocumentsNotes: [],
    muzeDocumentsAnnotationScope: { 'aria-pressed': 'false' },
    muzeDocumentsAnnotationSearch: '',
    muzeDocumentsNotesEmpty: '',
    muzeDocumentsExternalSources: [],
    muzeDocumentsDestinations: [],
    muzeDocumentsDestinationField: { hidden: '' },
    muzeDocumentsThumbnails: [],
    muzeDocumentsThumbnailsPanel: { hidden: '' },
    muzeDocumentsThumbnailsToggle: { 'aria-expanded': 'false' },
    muzeDocumentsOutline: [],
    muzeDocumentsOutlinePanel: { hidden: '' },
    muzeDocumentsOutlineToggle: { 'aria-expanded': 'false' },
    muzeDocumentsOutlineEmpty: { hidden: null },
    muzeDocumentsGroupStatus: 'Personal notes stay on this device.',
    muzeDocumentsReader: { hidden: null },
    muzeDocumentsEditorStatus: '',
    muzeDocumentsLinkStatus: '',
    muzeDocumentsFormatting: { hidden: '' },
    muzeDocumentsBold: { 'aria-pressed': 'false' },
    muzeDocumentsItalic: { 'aria-pressed': 'false' }
  },
  api: {
    StateGraph,
    xsd,
    validateFragment,
    readFragment,
    writeFragment,
    cobalt,
    named,
    literal,
    createSolidMetroClient,
    loadDocument,
    valueAt,
    many,
    readProfile,
    WorkspaceBroker,
    local,
    DOMPurify,
    ReaderState,
    AnnotationGroup,
    openGroup,
    saveGroup,
    createGroupDestination,
    doc
  },
  runtime: { host, groups: new Map(), page: 1, zoom: 1, rotation: 0 }
};
const ui = simply.app(prepareDefinition(definition));
exposeDefinition(ui, sources);
ui.definition.modules = {
  readerState: {
    sourceUrl: readerSource,
    origin: 'apps/documents/src/reader-state.mjs',
    dependencies: ['@muze-labs/solid-app-data']
  },
  annotations: {
    sourceUrl: annotationsSource,
    origin: 'apps/documents/src/annotations.mjs',
    dependencies: ['@muze-labs/solid-app-data']
  },
  pdf: {
    sourceUrl: pdfSource,
    origin: 'apps/documents/src/pdf.mjs',
    dependencies: ['pdfjs-dist', '@muze-labs/solid-app-data']
  },
  noteEditor: {
    sourceUrl: editorSource,
    origin: 'apps/documents/src/note-editor.mjs',
    dependencies: ['@muze-labs/cobalt-rich-text-note']
  }
};
simply.installEvents(ui);
await ui.actions.muzeDocumentsInitialize();
globalThis.muzeSolidDocumentsApp = ui;
