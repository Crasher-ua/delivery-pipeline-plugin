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
        var tasks = [];

        displayErrorIfAvailable(data, errorDiv);

        if (lastResponse === null || JSON.stringify(data.pipelines) !== JSON.stringify(lastResponse.pipelines)) {
            initializePipeline(divNames, data, pipelineid, jsplumb);

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
                    } else {
                        checkForAggregatedView(html, component);
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

                        buildStageHeader(html, stage, pipeline, true);
                        buildAllStageTasks(stage, i, tasks, data, html, view, pipeline, component, lastUpdate);

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

            lastResponse = data;

            equalheight('.pipeline-row .stage');
            buildAllFlowchartsConnections(data, jsplumb);
        } else {
            handleRepeatingPipelineRefresh(data, lastUpdate);
        }

        jsplumb.repaintEverything();
    }
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
