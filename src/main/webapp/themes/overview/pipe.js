function pipelineUtils() {
    var self = this;
    this.updatePipelines = function(divNames, errorDiv, view, fullscreen, page, component, showChanges, aggregatedChangesGroupingPattern, timeout, pipelineid, jsplumb) {
        Q.ajax({
            url: rootURL + '/' + view.viewUrl + 'api/json' + '?page=' + page + '&component=' + component + '&fullscreen=' + fullscreen,
            dataType: 'json',
            async: true,
            cache: false,
            timeout: 20000,
            success: function (data) {
                self.refreshPipelines(data, divNames, errorDiv, view, fullscreen, showChanges, aggregatedChangesGroupingPattern, pipelineid, jsplumb);
                setTimeout(function () {
                    self.updatePipelines(divNames, errorDiv, view, fullscreen, page, component, showChanges, aggregatedChangesGroupingPattern, timeout, pipelineid, jsplumb);
                }, timeout);
            },
            error: function (xhr, status, error) {
                Q('#' + errorDiv).html('Error communicating to server! ' + htmlEncode(error)).show();
                jsplumb.repaintEverything();
                setTimeout(function () {
                    self.updatePipelines(divNames, errorDiv, view, fullscreen, page, component, showChanges, aggregatedChangesGroupingPattern, timeout, pipelineid, jsplumb);
                }, timeout);
            }
        });
    }

    var lastResponse = null;

    this.refreshPipelines = function(data, divNames, errorDiv, view, showAvatars, showChanges, aggregatedChangesGroupingPattern, pipelineid, jsplumb) {
        var lastUpdate = data.lastUpdated;
        var pipeline;
        var component;
        var html;
        var trigger;
        var triggered;
        var tasks = [];

        displayErrorIfAvailable(data, errorDiv);

        if (lastResponse === null || JSON.stringify(data.pipelines) !== JSON.stringify(lastResponse.pipelines)) {
            for (var divId = 0; divId < divNames.length; divId++) {
                Q('#' + divNames[divId]).html('');
            }

            if (!data.pipelines || data.pipelines.length === 0) {
                Q('#pipeline-message-' + pipelineid).html('No pipelines configured or found. Please review the <a href="configure">configuration</a>')
            }

            jsplumb.reset();
            for (var c = 0; c < data.pipelines.length; c++) {
                html = [];
                component = data.pipelines[c];

                html.push('<section class="pipeline-component">');
                addPipelineHeader(html, component, data, c, resURL);
                html.push(getPagination(showAvatars, component));

                if (component.pipelines.length === 0) {
                    html.push('No builds done yet.');
                }
                for (var i = 0; i < component.pipelines.length; i++) {
                    pipeline = component.pipelines[i];

                    if (pipeline.triggeredBy && pipeline.triggeredBy.length > 0) {
                        triggered = '';
                        for (var y = 0; y < pipeline.triggeredBy.length; y++) {
                            trigger = pipeline.triggeredBy[y];
                            triggered = triggered + ' <span class="' + trigger.type + '">' + htmlEncode(trigger.description) + '</span>';
                            if (y < pipeline.triggeredBy.length - 1) {
                                triggered = triggered + ', ';
                            }
                        }
                    }

                    if (!pipeline.aggregated) {
                        html.push('<div class="panel">');
                        html.push('<div class="panel-header">');
                        html.push('<div class="panel-name">');
                        html.push('<b>' + pipeline.version + '</b>');
                        html.push('</div>');
                        html.push('<div class="date">' + getFormatFullDate(pipeline.timestamp) + ' (' + formatDate(pipeline.timestamp, lastUpdate) + ')</div>');
                        html.push('</div>');
                        html.push('<div class="panel-body">');
                        html.push('<div class="metrics">');
                        html.push('<div class="metric">');
                        html.push('<b>Commits</b>');
                        html.push('<span class="details">' + pipeline.commits + '</span>');
                        html.push('</div>');
                        html.push('<div class="metric">');
                        html.push('<b>Trigger Details</b>');
                        html.push('<span class="details">' + triggered + '</span>');
                        html.push('</div>');
                        html.push('<div class="metric">');
                        html.push('<b>Total Duration</b>');
                        html.push('<span class="details">' + formatDuration(pipeline.totalBuildTime) + '</span>');
                        html.push('</div>');
                        if (showChanges && pipeline.changes && pipeline.changes.length > 0) {
                            html.push('<div class="commit-changes">');
                            html.push('<b>Changes</b>');
                            html.push(generateChangeLog(pipeline.changes));
                            html.push('</div>');
                        }
                    } else if (component.pipelines.length > 1) {
                        html.push('<h2>Aggregated view</h2>');
                    }

                    html.push('</div>');
                    html.push('<section class="pipeline' + (pipeline.aggregated ? ' aggregated' : '') + '">');

                    var row = 0;
                    var column = 0;
                    var stage;

                    html.push('<div class="pipeline-row">');

                    for (var j = 0; j < pipeline.stages.length; j++) {
                        stage = pipeline.stages[j];
                        if (stage.row > row) {
                            html.push('</div><div class="pipeline-row">');
                            column = 0;
                            row++;
                        }

                        if (stage.column > column) {
                            for (var as = column; as < stage.column; as++) {
                                html.push('<div class="pipeline-cell"><div class="stage hide"></div></div>');
                                column++;
                            }
                        }

                        html.push('<div class="pipeline-cell">');
                        html.push('<div id="' + getStageId(stage.id + '', i) + '" class="stage ' + getStageClassName(stage.name) + '">');
                        html.push('<div class="stage-header"><div class="stage-name">' + htmlEncode(stage.name) + '</div>');

                        if (!pipeline.aggregated) {
                            html.push('<div class="clear"></div></div>');
                        } else {
                            var stageversion = stage.version || 'N/A';
                            html.push(' <div class="stage-version">' + htmlEncode(stageversion) + '</div><div class="clear"></div></div>');
                        }

                        var task;
                        var id;
                        var timestamp;
                        var progress;
                        var progressClass;
                        var consoleLogLink = '';

                        for (var k = 0; k < stage.tasks.length; k++) {
                            task = stage.tasks[k];

                            id = getTaskId(task.id, i);

                            timestamp = formatDate(task.status.timestamp, lastUpdate);

                            tasks.push({id: id, taskId: task.id, buildId: task.buildId});

                            progress = 100;
                            progressClass = 'task-progress-notrunning';

                            if (task.status.percentage) {
                                progress = task.status.percentage;
                                progressClass = 'task-progress-running';
                            } else if (isTaskLinkedToConsoleLog(data, task)) {
                                consoleLogLink = 'console';
                            }

                            html.push(
                                '<div id="' + id + '" class="status stage-task ' + task.status.type + '">'
                                + '<div class="task-progress ' + progressClass + '" style="width: ' + progress + '%">'
                                + '<div class="task-content">'
                                + '<div class="task-header">'
                                + '<div class="taskname">'
                                + '<a href="' + getLink(data, task.link) + consoleLogLink + '">' + htmlEncode(task.name) + '</a>'
                                + '</div>'
                            );
                            if (data.allowManualTriggers && task.manual && task.manualStep.enabled && task.manualStep.permission) {
                                html.push('<div class="task-manual" id="manual-' + id + '" title="Trigger manual build" onclick="triggerManual(\'' + id + '\', \'' + task.id + '\', \'' + task.manualStep.upstreamProject + '\', \'' + task.manualStep.upstreamId + '\', \'' + view.viewUrl + '\')">');
                                html.push('</div>');
                            } else if (!pipeline.aggregated) {
                                if (data.allowRebuild && task.rebuildable) {
                                    html.push('<div class="task-rebuild" id="rebuild-' + id + '" title="Trigger rebuild" onclick="triggerRebuild(\'' + id + '\', \'' + task.id + '\', \'' + task.buildId + '\', \'' + view.viewUrl + '\')">');
                                    html.push('</div>');
                                }
                                if (task.requiringInput) {
                                    html.push('<div class="task-manual" id="input-' + id + '" title="Specify input" onclick="specifyInput(\'' + id + '\', \'' + component.name + '\', \'' + task.buildId + '\', \'' + view.viewUrl + '\')">');
                                    html.push('</div>');
                                }
                            }

                            html.push('</div><div class="task-details">');

                            if (timestamp !== '') {
                                html.push('<div id="' + id + '.timestamp" class="timestamp">' + timestamp + '</div>');
                            }

                            if (task.status.duration >= 0) {
                                html.push('<div class="duration">' + formatDuration(task.status.duration) + '</div>');
                            }

                            html.push('</div></div></div></div>');

                            html.push(generateDescription(data, task));
                            html.push(generateTestInfo(data, task));
                            html.push(generateStaticAnalysisInfo(data, task));
                            html.push(generatePromotionsInfo(data, task));
                        }

                        if (pipeline.aggregated && stage.changes && stage.changes.length > 0) {
                            html.push(generateAggregatedChangelog(stage.changes, aggregatedChangesGroupingPattern));
                        }

                        html.push('</div></div>');
                        column++;
                    }

                    html.push('</section>');
                    html.push('</div>');
                    html.push('</div>');
                    html.push('</div>');
                }
                html.push(getPagination(showAvatars, component));
                html.push('</section>');
                Q('#' + divNames[c % divNames.length]).append(html.join(''));
                Q('#pipeline-message-' + pipelineid).html('');
            }

            var source;
            var target;
            lastResponse = data;
            equalheight('.pipeline-row .stage');

            Q.each(data.pipelines, function (dataPipelineIndex, component) {
                Q.each(component.pipelines, function (componentPipelineIndex, pipeline) {
                    Q.each(pipeline.stages, function (pipelineStagesIndex, stage) {
                        if (stage.downstreamStages) {
                            Q.each(stage.downstreamStageIds, function (l, value) {
                                source = getStageId(stage.id + '', componentPipelineIndex);
                                target = getStageId(value + '', componentPipelineIndex);

                                jsplumb.connect({
                                    source: source,
                                    target: target,
                                    anchors: [[1, 0, 1, 0, 0, 37], [0, 0, -1, 0, 0, 37]], // allow boxes to increase in height but keep anchor lines on the top
                                    overlays: [
                                        [ 'Arrow', { location: 1, foldback: 0.9, width: 12, length: 12}]
                                    ],
                                    cssClass: 'relation',
                                    connector: ['Flowchart', { stub: 25, gap: 2, midpoint: 1, alwaysRespectStubs: true } ],
                                    paintStyle: { lineWidth: 2, strokeStyle: 'rgba(118,118,118,1)' },
                                    endpoint: ['Blank']
                                });
                            });
                        }
                    });
                });
            });
        } else {
            var comp;
            var pipe;
            var head;
            var st;
            var ta;
            var time;

            for (var p = 0; p < data.pipelines.length; p++) {
                comp = data.pipelines[p];
                for (var d = 0; d < comp.pipelines.length; d++) {
                    pipe = comp.pipelines[d];
                    head = document.getElementById(pipe.id);
                    if (head) {
                        head.innerHTML = formatDate(pipe.timestamp, lastUpdate)
                    }

                    for (var l = 0; l < pipe.stages.length; l++) {
                        st = pipe.stages[l];
                        for (var m = 0; m < st.tasks.length; m++) {
                            ta = st.tasks[m];
                            time = document.getElementById(getTaskId(ta.id, d) + '.timestamp');
                            if (time) {
                                time.innerHTML = formatDate(ta.status.timestamp, lastUpdate);
                            }
                        }
                    }
                }
            }
        }
        jsplumb.repaintEverything();
    }
}

function generateDescription(data, task) {
    if (data.showDescription && task.description && task.description !== '') {
        var html = ['<div class="infoPanelOuter">'];
        html.push('<div class="infoPanel"><div class="infoPanelInner">' + task.description.replace(/\r\n/g, '<br/>') + '</div></div>');
        html.push('</div>');
        return html.join('');
    }
}

function generateTestInfo(data, task) {
    if (!data.showTestResults || !task.testResults || task.testResults.length === 0) {
        return undefined;
    }

    var html = ['<div class="infoPanelOuter">'];

    Q.each(task.testResults, function(i, analysis) {
        html.push('<div class="infoPanel"><div class="infoPanelInner">');
        html.push('<a href=' + getLink(data,analysis.url) + '>' + analysis.name + '</a>');
        html.push('<table id="priority.summary" class="pane">');
        html.push('<tbody>');
        html.push('<tr>');
        html.push('<td class="pane-header">Total</td>');
        html.push('<td class="pane-header">Failures</td>');
        html.push('<td class="pane-header">Skipped</td>');
        html.push('</tr>');
        html.push('</tbody>');
        html.push('<tbody>');
        html.push('<tr>');
        html.push('<td class="pane">' + analysis.total + '</td>');
        html.push('<td class="pane">' + analysis.failed + '</td>');
        html.push('<td class="pane">' + analysis.skipped + '</td>');
        html.push('</tr>');
        html.push('</tbody>');
        html.push('</table>');
        html.push('</div></div>');
    });

    html.push('</div>');
    return html.join('');
}

function generateStaticAnalysisInfo(data, task) {
    if (!data.showStaticAnalysisResults || !task.staticAnalysisResults || task.staticAnalysisResults.length === 0) {
        return undefined;
    }

    var html = ['<div class="infoPanelOuter">'];
    html.push('<div class="infoPanel"><div class="infoPanelInner">');
    html.push('<table id="priority.summary" class="pane">');
    html.push('<thead>');
    html.push('<tr>');
    html.push('<td class="pane-header">Warnings</td>');
    html.push('<td class="pane-header" style="font-size: smaller; vertical-align: bottom">High</td>');
    html.push('<td class="pane-header" style="font-size: smaller; vertical-align: bottom">Normal</td>');
    html.push('<td class="pane-header" style="font-size: smaller; vertical-align: bottom">Low</td>');
    html.push('</tr>');
    html.push('</thead>');
    html.push('<tbody>');

    Q.each(task.staticAnalysisResults, function(i, analysis) {
        html.push('<tr>');
        html.push('<td class="pane"><a href=' + getLink(data,analysis.url) + '>' + trimWarningsFromString(analysis.name) + '</a></td>');
        html.push('<td class="pane" style="text-align: center">' + analysis.high + '</td>');
        html.push('<td class="pane" style="text-align: center">' + analysis.normal + '</td>');
        html.push('<td class="pane" style="text-align: center">' + analysis.low + '</td>');
        html.push('</tr>');
    });

    html.push('</tbody>');
    html.push('</table>');
    html.push('</div></div>');
    html.push('</div>');
    return html.join('');
}

function generateChangeLog(changes) {
    if (changes.length === 0) {
        return '<span>No changes.</span>';
    }

    var html = [];

    for (var i = 0; i < changes.length; i++) {
        html.push('<div class="commit-changes-body">');

        html.push('<span>');

        var change = changes[i];
        if (change.changeLink) {
            html.push('<a href="' + change.changeLink + '">');
        }

        html.push('Commit <span class="change-commit-id">' + htmlEncode(change.commitId) + '</span>');

        if (change.changeLink) {
            html.push('</a>');
        }
        html.push(' by ' + htmlEncode(change.author.name) + '</span>');
        html.push('<div> - <b>' + change.message + '</b></div>');
        html.push('</div>');
    }

    return html.join('');
}

function getFormattedDate(date, format) {
    return date !== null ? moment(date, 'YYYY-MM-DDTHH:mm:ss').format(format) : '';
}

function getFormatMonthYear(date) {
    return getFormattedDate(date, 'MMMM YYYY');
}

function getFormatDay(date) {
    return getFormattedDate(date, 'DD');
}

function getFormatTime(date) {
    return getFormattedDate(date, 'h:mm a');
}

function getFormatFullDate(date) {
    return getFormattedDate(date, 'YYYY-MM-DD HH:mm:ss');
}
