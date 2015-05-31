module.exports = function(grunt) {
  var package = grunt.file.readJSON('package.json'),
      pipe = require('./pipe-grunt.js')(grunt);

  require('time-grunt')(grunt);

  grunt.initConfig({
    name: package.name,

    jshint: {
        src: package.files,
        options: {
            jshintrc: '.jshintrc',
            reporter: require('reporter-plus/jshint')
          }
      },
    jscs: {
        src: package.files,
        options: {
            config: '.jscsrc',
            reporter: require('reporter-plus/jscs').path
          }
      }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-jscs');
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask('test', function testTask() {
    pipe(
      [
          'copy',
          'copy',
          'copy'
        ],
      {
          expand: true,
          cwd: 'test',
          src: '*.*',
          dest: '.tmp'
        }
    );
  });
};
