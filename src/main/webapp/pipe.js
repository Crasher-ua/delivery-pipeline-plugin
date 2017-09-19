function pipelineUtils() {
    var self = this;
    this.updatePipelines = handlePipelineUpdate(self);

    var lastResponse = null;

    this.refreshPipelines = function(data, divNames, errorDiv, view, showAvatars, showChanges, aggregatedChangesGroupingPattern, pipelineid, jsplumb) {
        var lastUpdate = data.lastUpdated;
        var pipeline;
        var component;
        var html;
        var trigger;
        var triggered;
        var contributors;
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

                checkBuildAvailability(html, component);

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

                    contributors = [];
                    if (pipeline.contributors) {
                        Q.each(pipeline.contributors, function (index, contributor) {
                            contributors.push(htmlEncode(contributor.name));
                        });
                    }

                    if (contributors.length > 0) {
                        triggered = triggered + ' changes by ' + contributors.join(', ');
                    }

                    if (!pipeline.aggregated) {
                        html.push('<h2>' + htmlEncode(pipeline.version));
                        if (triggered !== '') {
                            html.push(' triggered by ' + triggered);
                        }

                        html.push(' started <span id="' + pipeline.id + '\">' + formatDate(pipeline.timestamp, lastUpdate) + '</span></h2>');

                        if (data.showTotalBuildTime) {
                            html.push('<h3>Total build time: ' + formatDuration(pipeline.totalBuildTime) + '</h3>');
                        }

                        if (showChanges && pipeline.changes && pipeline.changes.length > 0) {
                            html.push(generateChangeLog(pipeline.changes));
                        }
                    } else {
                        checkForAggregatedView(html, component);
                    }

                    html.push('<section class="pipeline">');

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

                        buildStageHeader(html, stage, pipeline, false);
                        buildAllStageTasks(stage, i, tasks, data, html, view, pipeline, component, lastUpdate);

                        if (pipeline.aggregated && stage.changes && stage.changes.length > 0) {
                            html.push(generateAggregatedChangelog(stage.changes, aggregatedChangesGroupingPattern));
                        }

                        html.push('</div></div>');
                        column++;
                    }

                    html.push('</div>');
                    html.push('</section>');

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

function generateChangeLog(changes) {
    var html = [
        '<div class="changes">',
        '<h1>Changes:</h1>'
    ];

    for (var i = 0; i < changes.length; i++) {
        html.push('<div class="change">');
        var change = changes[i];

        if (change.changeLink) {
            html.push('<a href="' + change.changeLink + '">');
        }

        html.push('<div class="change-commit-id">' + htmlEncode(change.commitId) + '</div>');

        if (change.changeLink) {
            html.push('</a>');
        }

        html.push('<div class="change-author">' + htmlEncode(change.author.name) + '</div>');
        html.push('<div class="change-message">' + change.message + '</div>');
        html.push('</div>');
    }
    html.push('</div>');
    return html.join('');
}
