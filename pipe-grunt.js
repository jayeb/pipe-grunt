var _ = require('lodash'),
    path = require('path');

module.exports = function pipeGrunt(grunt, pipeOptions) {
  pipeOptions = _.defaults({}, pipeOptions, {
    tempCwd: '.'
  });

  grunt.registerMultiTask('pipegrunt-clean', function cleanTask() {
    _.each(this.filesSrc, function precleanLoop(filepath) {
      if (grunt.file.exists(filepath)) {
        grunt.file.delete(filepath);
      }
    });
  });

  grunt.registerMultiTask('pipegrunt-copy', function copyTask() {
    _.each(this.files, function copyLoop(file) {
      grunt.file.copy(file.src, file.dest);
    });
  });

  function parseTaskInfo(input) {
    var splitName;

    if (_.isObject(input)) {
      return {
        task: input.task,
        target: input.target,
        full: _.compact([input.task, input.target]).join(':'),
        config: input.config || {},
        files: input.files
      };
    } else {
      splitName = input.split(':');

      return {
        task: splitName[0],
        target: splitName[1],
        full: input,
        config: undefined,
        files: undefined
      };
    }
  }

  function buildNewConfig(taskInfo) {
    var currentConfig = grunt.config(_.compact([taskInfo.task, taskInfo.target]));

    return _.merge(
      {},
      currentConfig,
      taskInfo.config
    );
  }

  function buildFileBlock(taskInfo, srcs, pipeTarget) {
    var tempDir = path.join(pipeOptions.tempCwd, '.' + pipeTarget + '-' + taskInfo.task),
        newFiles,
        normalizedNewFiles,
        defaultFilesObj,
        srcsCwd = path.dirname(srcs[0]),
        srcsBasenames = _.map(srcs, path.basename);

    defaultFilesObj = {
      expand: true,
      cwd: srcsCwd,
      src: srcsBasenames,
      dest: tempDir
    };

    // Build new file object
    if (taskInfo.files) {
      if (_.isArray(taskInfo.files)) {
        newFiles = {
          files: _.map(taskInfo.files, function mapTaskFiles(fileObj) {
              var mappedSrcs,
                  dest;

              mappedSrcs = _.chain([fileObj.src]).flatten().map(function mapSrcs(src) {
                var base = path.basename(src),
                    pathComponents = [];

                if (_.contains(srcsBasenames, base)) {
                  pathComponents.push(srcsCwd);
                  pathComponents.push(_.rest(src.split(path.sep)));
                  pathComponents = _.flatten(pathComponents);

                  return path.join.apply(null, pathComponents);
                } else {
                  return null;
                }
              }).compact().value();

              dest = tempDir;
              if (fileObj.dest) {
                dest += path.join(dest, path.basename(fileObj.dest));
              }

              grunt.file.write(dest, '');

              return {
                src: mappedSrcs,
                dest: dest
              };
            })
        };
      } else if (_.isObject(taskInfo.files)) {
        if (taskInfo.files.dest) {
          newFiles = {
            src: srcs,
            dest: path.join(tempDir, path.basename(taskInfo.files.dest))
          };
        } else {
          newFiles = _.extend({}, taskInfo.files, defaultFilesObj);
        }
      } else if (_.isString(taskInfo.files)) {
        newFiles = {
          src: srcs,
          dest: path.join(tempDir, taskInfo.files)
        };
      }
    }

    if (!newFiles) {
      newFiles = defaultFilesObj;
    }

    normalizedNewFiles = grunt.task.normalizeMultiTaskFiles(newFiles);

    _.each(normalizedNewFiles, function fileTouchLoop(file) {
      // Touch the file, to hold its place
      grunt.file.write(file.dest, '');
    });

    return normalizedNewFiles;
  }

  function copyAndClean(files, pipeTarget, preclean, postclean) {
    var config = {
            'pipegrunt-clean': {},
            'pipegrunt-copy': {}
          },
        tasks = [];

    // One final task to move files to ultimate destination

    if (preclean) {
      config['pipegrunt-clean'][pipeTarget + '-pre'] = {
        src: path.dirname(files[0].dest)
      };
      tasks.push('pipegrunt-clean:' + pipeTarget + '-pre');
    }

    config['pipegrunt-copy'][pipeTarget] = {files: files};
    tasks.push('pipegrunt-copy:' + pipeTarget);

    if (postclean) {
      config['pipegrunt-clean'][pipeTarget + '-post'] = {
        src: [path.join(pipeOptions.tempCwd, '.pipegrunt-*/')]
      };
      tasks.push('pipegrunt-clean:' + pipeTarget + '-post');
    }

    grunt.config.merge(config);
    grunt.task.run(tasks);
  }

  return function pipeTasks(taskList, originalFiles, options) {
    var pipeTarget = 'pipegrunt-' + _.now().toString(),
        normalizedOriginalFiles,
        inputFiles,
        outputFiles,
        finalFiles;

    options = _.defaults({}, options, {
      preclean: false,
      postclean: true
    });

    if (_.isArray(originalFiles)) {
      originalFiles = {files: originalFiles};
    }
    normalizedOriginalFiles = grunt.task.normalizeMultiTaskFiles(originalFiles);

    inputFiles = _.chain(normalizedOriginalFiles).pluck('src').flatten().value();

    taskList = _.flatten([taskList]);

    if (taskList.length) {
      // Execute tasks
      outputFiles = _.reduce(taskList, function executeTasks(srcs, task, taskIndex) {
        var taskInfo = parseTaskInfo(task),
            taskTarget = pipeTarget + '-' + taskIndex,
            newConfig = {},
            newFiles;

        newConfig[taskInfo.task] = {};
        newConfig[taskInfo.task][taskTarget] = buildNewConfig(taskInfo);

        if (taskInfo.files !== false && srcs.length) {
          newFiles = buildFileBlock(taskInfo, srcs, taskTarget);
          newConfig[taskInfo.task][taskTarget].files = newFiles;
        }

        // Apply cloned config
        grunt.config.merge(newConfig);

        // Execute the task
        grunt.task.run(taskInfo.task + ':' + taskTarget);

        grunt.verbose.writeln('Piping ' + taskInfo.full + ' task as ' + taskTarget);

        if (!!newFiles) {
          return _.pluck(newFiles, 'dest');
        } else {
          return _.clone(srcs);
        }
      }, inputFiles);

      if (outputFiles.length) {
        finalFiles = grunt.task.normalizeMultiTaskFiles({
          expand: true,
          cwd: path.dirname(outputFiles[0]),
          src: '**/*',
          dest: normalizedOriginalFiles[0].dest
        });
      } else {
        finalFiles = normalizedOriginalFiles;
      }
    } else {
      finalFiles = normalizedOriginalFiles;
    }

    copyAndClean(finalFiles, pipeTarget, options.preclean, options.postclean);
  };
};
