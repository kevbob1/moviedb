// See the shakacode/shakapacker README and docs directory for advice on customizing your webpackConfig.
const { generateWebpackConfig } = require('shakapacker')

const customConfig = {
  resolve: {
    extensions: ['.css']
  }
}

const webpackConfig = generateWebpackConfig(customConfig)

// Add postcss-loader to existing CSS rules for Tailwind v4 support
webpackConfig.module.rules.forEach(rule => {
  if (rule.test && rule.test.toString().includes('css')) {
    if (rule.use && Array.isArray(rule.use)) {
      // Insert postcss-loader after css-loader
      const cssLoaderIndex = rule.use.findIndex(u =>
        (typeof u === 'string' && u.includes('css-loader')) ||
        (typeof u === 'object' && u.loader && u.loader.includes('css-loader'))
      )
      if (cssLoaderIndex !== -1) {
        rule.use.splice(cssLoaderIndex + 1, 0, 'postcss-loader')
      }
    }
  }
})

module.exports = webpackConfig
