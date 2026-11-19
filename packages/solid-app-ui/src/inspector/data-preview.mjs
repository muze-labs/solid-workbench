const rdfValue = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#value';
const previewSubject = 'urn:muze:solid-workbench:inspected-value';

function isOldmTerm(value) {
  return value instanceof oldm.BlankNode || value instanceof oldm.Collection ||
    ((value instanceof String || value instanceof Number) &&
      Boolean(value.type || value.language));
}

function isRdfValue(value) {
  if (value instanceof oldm.Graph || isOldmTerm(value)) {
    return true;
  }
  return Array.isArray(value) && value.some(isOldmTerm) &&
    value.every((item) => isOldmTerm(item) ||
      ['string', 'boolean', 'number'].includes(typeof item));
}

function writeTurtle(value) {
  if (value instanceof oldm.Graph) {
    return oldm.turtleWriter(value);
  }
  const termGraph = Array.isArray(value)
    ? value.find((item) => item?.graph)?.graph
    : undefined;
  const graph = value.graph ?? termGraph ??
    oldm.context().parse('', previewSubject, 'text/turtle');
  const describedNode = value instanceof oldm.NamedNode &&
    Object.keys(value).some((key) => key !== 'id');
  // A standalone term needs a subject and predicate to form valid Turtle.
  const subjects = describedNode
    ? { [value.id]: value }
    : { [previewSubject]: { [rdfValue]: value } };
  return oldm.turtleWriter({
    subjects,
    baseURI: graph.baseURI,
    prefixEntries: (preference) => graph.prefixEntries(preference),
    fullURI: (id) => graph.fullURI(id),
    relativeURI: (id) => graph.relativeURI(id),
    getType: (literal) => graph.getType(literal)
  });
}

export async function previewBoundData(owner, path) {
  let dataFormat = 'JSON';
  try {
    const value = simply.raw(simply.getValueByPath(owner.data, path));
    if (isRdfValue(value)) {
      dataFormat = 'Turtle';
      return { dataFormat, dataText: await writeTurtle(value) };
    }
    const json = JSON.stringify(value, null, 2);
    return {
      dataFormat,
      dataText: json ?? 'This value has no JSON representation.'
    };
  }
  catch {
    return {
      dataFormat,
      dataText: 'This value could not be represented as ' + dataFormat + '.'
    };
  }
}
