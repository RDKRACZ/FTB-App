const path = require('path');

module.exports = {
    publicPath: './',
    lintOnSave: false,
    outputDir: path.resolve(__dirname, '../../dist/desktop'),
    chainWebpack: (config) => {
        config.plugin('copy').tap((options) => {
            options[0][0].ignore.push('./public/css/**/*');
            options[0][0].ignore.push('/public/css/**/*');
            options[0][0].ignore.push('public/css/**/*');
            options[0][0].ignore.push('/css/**/*');
            options[0][0].ignore.push('css/**/*');
            options[0][0].ignore.push('./public/img/**/*');
            options[0][0].ignore.push('/public/img/**/*');
            options[0][0].ignore.push('public/img/**/*');
            options[0][0].ignore.push('/img/**/*');
            options[0][0].ignore.push('img/**/*');
            return options;
        });
    },
    pages: {
        index: {
          // entry for the page
          entry: 'src/main.ts',
          template: 'public/index.html',
          filename: 'index.html',
          title: 'FTBApp',
          chunks: ['chunk-vendors', 'chunk-common', 'index']
        },
        // when using the entry-only string format,
        // template is inferred to be `public/subpage.html`
        // and falls back to `public/index.html` if not found.
        // Output filename is inferred to be `subpage.html`.
        chatPage: 'src/main.ts'
    }
};