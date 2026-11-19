/** The RDF backend selected by this application's build and Node tests. */
import * as coreModule from '@muze-nl/oldm-core';
import { relativeIRI, turtlePrefixedIRI } from '@muze-nl/oldm-core/iri';
import {
  turtleParser,
  turtleWriter,
  turtlePatchWriter
} from '@muze-labs/oldm-turtle';

const { default: createContext, ...core } = coreModule;

const oldm = {
  ...core,
  relativeIRI,
  turtlePrefixedIRI,
  turtleParser,
  turtleWriter,
  turtlePatchWriter,
  context({
    parser = turtleParser,
    writer = turtleWriter,
    patchWriter = turtlePatchWriter,
    ...options
  } = {}) {
    return createContext({ ...options, parser, writer, patchWriter });
  }
};

globalThis.oldm = oldm;
export default oldm;
