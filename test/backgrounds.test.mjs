import test from 'node:test';
import assert from 'node:assert/strict';
import {
  storeUpload,
  cachedImage,
  uploadBackground,
  adoptAnonymousImages
} from '../apps/launcher/src/backgrounds.mjs';

const buckets = new Map();
globalThis.caches = {
  async open(name) {
    if (!buckets.has(name)) {
      buckets.set(name, new Map());
    }
    const entries = buckets.get(name);
    return {
      async match(key) {
        return entries.get(key)?.clone();
      },
      async put(key, response) {
        entries.set(key, response.clone());
      }
    };
  }
};
// Image decoding itself is exercised with a real PNG in the Chrome scenario.
globalThis.createImageBitmap = async () => ({ close() {} });
const image = () => new Blob(['original image bytes'], { type: 'image/png' });
const owner = 'https://example.test/me';
const workspaceUrl = 'https://pod.test/private/workspace.ttl';

test('background files stay owner-scoped and survive failed or conflicting uploads', async () => {
  const id = await storeUpload(image(), owner);
  assert.equal(await cachedImage(id, 'https://other.test/me'), null);
  const session = {
    client: {
      async put() {
        return new Response(null, { status: 403 });
      }
    }
  };
  await assert.rejects(uploadBackground(id, owner, session, workspaceUrl));
  assert.equal(
    await (await cachedImage(id, owner)).text(),
    'original image bytes'
  );
  session.client.put = async () => new Response(null, { status: 412 });
  session.client.get = async () =>
    new Response(
      new Blob(['different'], {
        type: 'image/png'
      })
    );
  await assert.rejects(
    uploadBackground(id, owner, session, workspaceUrl),
    /different contents/
  );
  assert.equal(
    await (await cachedImage(id, owner)).text(),
    'original image bytes'
  );
});

test('lost image upload responses recover only after exact conditional retry verification', async () => {
  const id = await storeUpload(image(), owner);
  let saved;
  let writes = 0;
  let destination;
  const session = {
    client: {
      async put(url, options) {
        assert.equal(options.headers['If-None-Match'], '*');
        assert.equal(options.headers['Content-Type'], 'image/png');
        writes += 1;
        if (writes === 1) {
          saved = options.body;
          destination = url;
          throw new Error('response lost');
        }
        assert.equal(url, destination);
        return new Response(null, { status: 412 });
      },
      async get(url) {
        assert.equal(url, destination);
        return new Response(saved);
      }
    }
  };
  await assert.rejects(uploadBackground(id, owner, session, workspaceUrl));
  assert.equal(await cachedImage(destination, owner), null);
  const acknowledged = await uploadBackground(id, owner, session, workspaceUrl);
  assert.match(
    acknowledged,
    /^https:\/\/pod.test\/private\/background-.*\.png$/
  );
  assert.equal(
    await (await cachedImage(acknowledged, owner)).text(),
    'original image bytes'
  );
  assert.equal(
    await (await cachedImage(id, owner)).text(),
    'original image bytes'
  );
  assert.equal(writes, 2);
});

test('known anonymous background adoption retains its original cache and isolates other owners', async () => {
  const id = await storeUpload(image(), '');
  await adoptAnonymousImages({ entries: [{ background: id }] }, owner);
  assert.equal(
    await (await cachedImage(id, owner)).text(),
    'original image bytes'
  );
  assert.equal(
    await (await cachedImage(id, '')).text(),
    'original image bytes'
  );
  assert.equal(await cachedImage(id, 'https://unrelated.test/me'), null);
  await assert.rejects(
    storeUpload(new Blob(['bad'], { type: 'text/plain' }), owner)
  );
});

test('failed local background staging retains the previous workspace choice', async () => {
  const { launcherBackground } = await import(
    '../apps/launcher/src/components/background.mjs'
  );
  const previous = {
    directory: { active: 'default', entries: [{ id: 'default', background: 'https://pod.test/old.png' }] }
  };
  const persistence = {
    snapshot: previous,
    async stage(next) {
      this.snapshot = next;
      throw new Error('local disk unavailable');
    }
  };
  const context = {
    api: { activeWorkspace(snapshot) { return snapshot.directory.entries[0]; } },
    runtime: { persistence },
    actions: { swb_requireOwner() {} }
  };
  await assert.rejects(
    launcherBackground.actions.swb_stageBackground.call(context, 'https://pod.test/new.png'),
    /local disk unavailable/
  );
  assert.deepEqual(persistence.snapshot, previous);
});
