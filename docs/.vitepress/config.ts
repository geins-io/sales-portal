import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Sales Portal',
  description: 'Documentation for the Sales Portal - Multi-tenant Storefront Application',

  // Use /docs/ as the base path for GitHub Pages deployment
  base: '/docs/',

  // Source directory is the docs folder itself
  srcDir: '.',

  // Exclude VitePress config from being processed as content
  srcExclude: ['.vitepress/**/*'],

  // Theme configuration
  themeConfig: {
    // Logo and site title
    logo: '/logo.svg',
    siteTitle: 'Sales Portal',

    // Navigation bar
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'Testing', link: '/testing' },
    ],

    // Sidebar configuration
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is Sales Portal?', link: '/' },
          { text: 'Getting Started', link: '/guide/getting-started' },
        ],
      },
      {
        text: 'Architecture',
        items: [
          { text: 'Overview', link: '/architecture' },
          { text: 'Multi-Tenant System', link: '/guide/multi-tenant' },
          { text: 'Theming System', link: '/guide/theming' },
        ],
      },
      {
        text: 'Development',
        items: [
          { text: 'Testing', link: '/testing' },
          { text: 'API Reference', link: '/guide/api-reference' },
          { text: 'Contributing', link: '/guide/contributing' },
        ],
      },
    ],

    // Social links
    socialLinks: [{ icon: 'github', link: 'https://github.com/litium/sales-portal' }],

    // Search
    search: {
      provider: 'local',
    },

    // Footer
    footer: {
      message: 'Built with VitePress',
      copyright: 'Copyright © 2026 Litium',
    },

    // Edit link configuration
    editLink: {
      pattern: 'https://github.com/litium/sales-portal/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    // Last updated
    lastUpdated: {
      text: 'Updated at',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    },
  },

  // Markdown configuration
  markdown: {
    lineNumbers: true,
  },

  // Build configuration
  lastUpdated: true,

  // Clean URLs (remove .html extension)
  cleanUrls: true,

  // Head configuration
  head: [
    ['link', { rel: 'icon', href: '/docs/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Sales Portal Documentation' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'Documentation for the Sales Portal - Multi-tenant Storefront Application',
      },
    ],
  ],
})
