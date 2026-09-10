import { createServer } from 'vite';

async function test() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });

  try {
    const { default: React } = await server.ssrLoadModule('react');
    const { renderToString } = await server.ssrLoadModule('react-dom/server');
    const { default: App } = await server.ssrLoadModule('/src/App.jsx');
    
    const html = renderToString(React.createElement(App));
    console.log('RENDER SUCCESS! Length of rendered HTML:', html.length);
  } catch (err) {
    console.error('RENDER ERROR:', err);
  } finally {
    await server.close();
  }
}

test();
