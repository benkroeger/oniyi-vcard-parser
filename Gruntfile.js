'use strict';

module.exports = function (grunt) {
  // Show elapsed time at the end
  require('time-grunt')(grunt); // eslint-disable-line global-require
  // Load all grunt tasks
  require('load-grunt-tasks')(grunt); // eslint-disable-line global-require

  grunt.initConfig({
    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: require('jshint-stylish'), // eslint-disable-line global-require
      },
      gruntfile: {
        src: ['Gruntfile.js'],
      },
      js: {
        src: ['*.js'],
      },
      test: {
        src: ['test/**/*.js'],
      },
    },
    mochacli: {
      options: {
        reporter: 'nyan',
        bail: true,
      },
      all: ['test/*.js'],
    },
    watch: {
      gruntfile: {
        files: '<%= jshint.gruntfile.src %>',
        tasks: ['jshint:gruntfile'],
      },
      js: {
        files: '<%= jshint.js.src %>',
        tasks: ['jshint:js', 'mochacli'],
      },
      test: {
        files: '<%= jshint.test.src %>',
        tasks: ['jshint:test', 'mochacli'],
      },
    },
  });

  grunt.registerTask('default', ['jshint', 'mochacli']);
};
