module.exports = function(grunt) {
  var package = grunt.file.readJSON('package.json');

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
};
