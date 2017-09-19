function handlePipelineUpdate(self) {
    return function(divNames, errorDiv, view, fullscreen, page, component, showChanges, aggregatedChangesGroupingPattern, timeout, pipelineid, jsplumb) {
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
    };
}

function handleRepeatingPipelineRefresh(data, lastUpdate) {
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

function addPipelineHeader(html, component, data, c, resURL) {
    html.push('<h1>' + htmlEncode(component.name));
    if (data.allowPipelineStart) {
        if (component.workflowComponent) {
            html.push('&nbsp;<a id="startpipeline-' + c  +'" class="task-icon-link" href="#" onclick="triggerBuild(\'' + component.workflowUrl + '\', \'' + data.name + '\')">');
        } else if (component.firstJobParameterized) {
            html.push('&nbsp;<a id="startpipeline-' + c  +'" class="task-icon-link" href="#" onclick="triggerParameterizedBuild(\'' + component.firstJobUrl + '\', \'' + data.name + '\')">');
        } else {
            html.push('&nbsp;<a id="startpipeline-' + c  +'" class="task-icon-link" href="#" onclick="triggerBuild(\'' + component.firstJobUrl + '\', \'' + data.name + '\')">');
        }
        html.push('<img class="icon-clock icon-md" title="Build now" src="' + resURL + '/images/24x24/clock.png">');
        html.push('</a>');
    }
    html.push('</h1>');
}

function displayErrorIfAvailable(data, errrorDivId) {
    var cErrorDiv = Q('#' + errrorDivId);
    if (data.error) {
        cErrorDiv.html('Error: ' + data.error).show();
    } else {
        cErrorDiv.hide().html('');
    }
}

function isTaskLinkedToConsoleLog(data, task) {
    return data.linkToConsoleLog
        && (task.status.success
        || task.status.failed
        || task.status.unstable
        || task.status.cancelled);
}

function getPagination(showAvatars, component) {
    if (showAvatars || component.pagingData === '') {
        return '';
    }

    var html = [];
    html.push('<div class="pagination">');
    html.push(component.pagingData);
    html.push('</div>');
    return html.join('');
}

function getLink(data, link) {
    return data.linkRelative ? link : rootURL + '/' + link;
}

function trimWarningsFromString(label) {
    var offset = label.indexOf('Warnings');
    return offset === -1 ? label : label.substring(0, offset).trim();
}

function generatePromotionsInfo(data, task) {
    if (!data.showPromotions || !task.status.promoted || !task.status.promotions || task.status.promotions.length === 0) {
        return undefined;
    }

    var html = ['<div class="infoPanelOuter">'];
    Q.each(task.status.promotions, function(i, promo) {
        html.push('<div class="infoPanel"><div class="infoPanelInner"><div class="promo-layer">');
        html.push('<img class="promo-icon" height="16" width="16" src="' + rootURL + promo.icon + '"/>');
        html.push('<span class="promo-name"><a href="' + getLink(data,task.link) + 'promotion">' + htmlEncode(promo.name) + '</a></span><br/>');
        if (promo.user !== 'anonymous') {
            html.push('<span class="promo-user">' + promo.user + '</span>');
        }
        html.push('<span class="promo-time">' + formatDuration(promo.time) + '</span><br/>');
        if (promo.params.length > 0) {
            html.push('<br/>');
        }
        Q.each(promo.params, function (j, param) {
            html.push(param.replace(/\r\n/g, '<br/>') + '<br />');
        });
        html.push('</div></div></div>');
    });
    html.push('</div>');
    return html.join('');
}

function generateAggregatedChangelog(stageChanges, aggregatedChangesGroupingPattern) {
    var html = [];
    html.push('<div class="aggregatedChangesPanelOuter">');
    html.push('<div class="aggregatedChangesPanel">');
    html.push('<div class="aggregatedChangesPanelInner">');
    html.push('<b>Changes:</b>');
    html.push('<ul>');

    var changes = {};

    var unmatchedChangesKey = '';

    if (aggregatedChangesGroupingPattern) {
        var re = new RegExp(aggregatedChangesGroupingPattern);

        stageChanges.forEach(function(stageChange) {
            var matches = stageChange.message.match(re) || [unmatchedChangesKey];

            Q.unique(matches).forEach(function (match) {
                changes[match] = changes[match] || [];
                changes[match].push(stageChange);
            });
        });
    } else {
        changes[unmatchedChangesKey] = stageChanges;
    }

    var keys = Object.keys(changes).sort().filter(function(matchKey) {
        return matchKey !== unmatchedChangesKey;
    });

    keys.push(unmatchedChangesKey);

    keys.forEach(function(matchKey) {
        if (matchKey !== unmatchedChangesKey) {
            html.push('<li class="aggregatedKey"><b>' + matchKey + '</b><ul>');
        }

        if (changes[matchKey]) {
            changes[matchKey].forEach(function (change) {
                html.push('<li>');
                html.push(change.message || '&nbsp;');
                html.push('</li>');
            });
        }

        if (matchKey !== unmatchedChangesKey) {
            html.push('</ul></li>');
        }
    });

    html.push('</ul>');
    html.push('</div>');
    html.push('</div>');
    html.push('</div>');

    return html.join('')
}

function getStageClassName(stagename) {
    return 'stage_' + replace(stagename, ' ', '_');
}

function getTaskId(taskname, count) {
    return 'task-' + replace(replace(taskname, ' ', '_'), '/', '_') + count;
}

function replace(string, replace, replaceWith) {
    var re = new RegExp(replace, 'g');
    return string.replace(re, replaceWith);
}

function formatDate(date, currentTime) {
    return date !== null ? moment(date, 'YYYY-MM-DDTHH:mm:ss').from(moment(currentTime, 'YYYY-MM-DDTHH:mm:ss')) : '';
}

function formatDuration(millis) {
    if (millis === 0) {
        return '0 sec';
    }

    var seconds = Math.floor(millis / 1000);
    var minutes = Math.floor(seconds / 60);
    var minstr;
    var secstr;

    seconds = seconds % 60;
    minstr = minutes === 0 ? '' : minutes + ' min ';
    secstr = '' + seconds + ' sec';

    return minstr + secstr;
}

function triggerManual(taskId, downstreamProject, upstreamProject, upstreamBuild, viewUrl) {
    Q('#manual-' + taskId).hide();
    var formData = {project: downstreamProject, upstream: upstreamProject, buildId: upstreamBuild};
    var before;

    if (crumb.value !== null && crumb.value !== '') {
        console.info('Crumb found and will be added to request header');
        before = function(xhr){xhr.setRequestHeader(crumb.fieldName, crumb.value);}
    } else {
        console.info('Crumb not needed');
        before = function(xhr){}
    }

    Q.ajax({
        url: rootURL + '/' + viewUrl + 'api/manualStep',
        type: 'POST',
        data: formData,
        beforeSend: before,
        timeout: 20000,
        async: true,
        success: function (data, textStatus, jqXHR) {
            console.info('Triggered build of ' + downstreamProject + ' successfully!');
        },
        error: function (jqXHR, textStatus, errorThrown) {
            window.alert('Could not trigger build! error: ' + errorThrown + ' status: ' + textStatus);
        }
    });
}

function triggerRebuild(taskId, project, buildId, viewUrl) {
    Q('#rebuild-' + taskId).hide();
    var formData = {project: project, buildId: buildId};

    var before;
    if (crumb.value !== null && crumb.value !== '') {
        console.info('Crumb found and will be added to request header');
        before = function(xhr){xhr.setRequestHeader(crumb.fieldName, crumb.value);}
    } else {
        console.info('Crumb not needed');
        before = function(xhr){}
    }

    Q.ajax({
        url: rootURL + '/' + viewUrl + 'api/rebuildStep',
        type: 'POST',
        data: formData,
        beforeSend: before,
        timeout: 20000,
        success: function (data, textStatus, jqXHR) {
            console.info('Triggered rebuild of ' + project + ' successfully!')
        },
        error: function (jqXHR, textStatus, errorThrown) {
            window.alert('Could not trigger rebuild! error: ' + errorThrown + ' status: ' + textStatus)
        }
    });
}

function specifyInput(taskId, project, buildId, viewUrl) {
    Q('#input-' + taskId).hide();
    var formData = {project: project, upstream: 'N/A', buildId: buildId};
    var before;

    if (crumb.value !== null && crumb.value !== '') {
        console.info('Crumb found and will be added to request header');
        before = function(xhr){xhr.setRequestHeader(crumb.fieldName, crumb.value);}
    } else {
        console.info('Crumb not needed');
        before = function(xhr){}
    }

    Q.ajax({
        url: rootURL + '/' + viewUrl + 'api/inputStep',
        type: 'POST',
        data: formData,
        beforeSend: before,
        timeout: 20000,
        success: function (data, textStatus, jqXHR) {
            console.info('Successfully triggered input step of ' + project + '!')
        },
        error: function (jqXHR, textStatus, errorThrown) {
            window.alert('Could not trigger input step! error: ' + errorThrown + ' status: ' + textStatus)
        }
    });
}

function triggerParameterizedBuild(url, taskId) {
    console.info('Job is parameterized');
    window.location.href = rootURL + '/' + url + 'build?delay=0sec';
}

function triggerBuild(url, taskId) {
    var before;
    if (crumb.value !== null && crumb.value !== '') {
        console.info('Crumb found and will be added to request header');
        before = function(xhr){xhr.setRequestHeader(crumb.fieldName, crumb.value);}
    } else {
        console.info('Crumb not needed');
        before = function(xhr){}
    }

    Q.ajax({
        url: rootURL + '/' + url + 'build?delay=0sec',
        type: 'POST',
        beforeSend: before,
        timeout: 20000,
        success: function (data, textStatus, jqXHR) {
            console.info('Triggered build of ' + taskId + ' successfully!')
        },
        error: function (jqXHR, textStatus, errorThrown) {
            window.alert('Could not trigger build! error: ' + errorThrown + ' status: ' + textStatus)
        }
    });
}

function htmlEncode(html) {
    return document.createElement('a')
        .appendChild(document.createTextNode(html))
        .parentNode.innerHTML
        .replace(/\n/g, '<br/>');
}

function getStageId(name, count) {
    var re = / /g;
    return name.replace(re, '_') + '_' + count;
}

function equalheight(container) {
    var currentTallest = 0;
    var currentRowStart = 0;
    var rowDivs = new Array();
    var $el;
    var topPosition = 0;

    Q(container).each(function () {
        $el = Q(this);
        Q($el).height('auto');
        topPosition = $el.position().top;

        if (currentRowStart !== topPosition) {
            rowDivs.length = 0; // empty the array
            currentRowStart = topPosition;
            currentTallest = $el.height() + 2;
            rowDivs.push($el);
        } else {
            rowDivs.push($el);
            currentTallest = (currentTallest < $el.height() + 2) ? ($el.height() + 2) : (currentTallest);
        }
        for (currentDiv = 0; currentDiv < rowDivs.length; currentDiv++) {
            rowDivs[currentDiv].height(currentTallest);
        }
    });
}

function checkBuildAvailability(html, component) {
    if (component.pipelines.length === 0) {
        html.push('No builds done yet.');
    }
}

function checkForAggregatedView(html, component) {
    if (component.pipelines.length > 1) {
        html.push('<h2>Aggregated view</h2>');
    }
}

function addSpecificTaskDetails(task, data, html, id) {
    var progress = 100;
    var progressClass = 'task-progress-notrunning';
    var consoleLogLink = '';

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
}

function checkAvailableTasks(data, task, html, id, view, pipeline, component) {
    if (data.allowManualTriggers && task.manual && task.manualStep.enabled && task.manualStep.permission) {
        html.push('<div class="task-manual" id="manual-' + id + '" title="Trigger manual build" onclick="triggerManual(\'' + id + '\', \'' + task.id + '\', \'' + task.manualStep.upstreamProject + '\', \'' + task.manualStep.upstreamId + '\', \'' + view.viewUrl + '\')">');
        html.push('</div>');
        return;
    }
    if (pipeline.aggregated) {
        return;
    }
    if (data.allowRebuild && task.rebuildable) {
        html.push('<div class="task-rebuild" id="rebuild-' + id + '" title="Trigger rebuild" onclick="triggerRebuild(\'' + id + '\', \'' + task.id + '\', \'' + task.buildId + '\', \'' + view.viewUrl + '\')">');
        html.push('</div>');
    }
    if (task.requiringInput) {
        html.push('<div class="task-manual" id="input-' + id + '" title="Specify input" onclick="specifyInput(\'' + id + '\', \'' + component.name + '\', \'' + task.buildId + '\', \'' + view.viewUrl + '\')">');
        html.push('</div>');
    }
}

function addTimeDetails(html, timestamp, id, task) {
    html.push('<div class="task-details">');

    if (timestamp !== '') {
        html.push('<div id="' + id + '.timestamp" class="timestamp">' + timestamp + '</div>');
    }

    if (task.status.duration >= 0) {
        html.push('<div class="duration">' + formatDuration(task.status.duration) + '</div>');
    }

    html.push('</div>');
}

function buildFullTaskLayout(task, data, html, id, view, pipeline, component, lastUpdate) {
    var timestamp = formatDate(task.status.timestamp, lastUpdate);

    addSpecificTaskDetails(task, data, html, id);
    checkAvailableTasks(data, task, html, id, view, pipeline, component);

    html.push('</div>');

    addTimeDetails(html, timestamp, id, task);

    html.push('</div></div></div>');

    html.push(generateDescription(data, task));
    html.push(generateTestInfo(data, task));
    html.push(generateStaticAnalysisInfo(data, task));
    html.push(generatePromotionsInfo(data, task));
}

function buildAllStageTasks(stage, i, tasks, data, html, view, pipeline, component, lastUpdate) {
    for (var k = 0; k < stage.tasks.length; k++) {
        var task = stage.tasks[k];
        var id = getTaskId(task.id, i);
        tasks.push({id: id, taskId: task.id, buildId: task.buildId});
        buildFullTaskLayout(task, data, html, id, view, pipeline, component, lastUpdate);
    }
}

function buildStageHeader(html, stage, pipeline, clear) {
    html.push('<div class="stage-header"><div class="stage-name">' + htmlEncode(stage.name) + '</div>');

    if (!pipeline.aggregated) {
        if (clear) {
            html.push('<div class="clear"></div>');
        }
        html.push('</div>');
    } else {
        var stageversion = stage.version || 'N/A';
        html.push(' <div class="stage-version">');
        html.push(htmlEncode(stageversion));
        html.push('</div>');
        if (clear) {
            html.push('<div class="clear"></div>');
        }
        html.push('</div>');
    }
}

function generateDescription(data, task) {
    if (!data.showDescription || !task.description || task.description === '') {
        return undefined;
    }

    var html = ['<div class="infoPanelOuter">'];
    html.push('<div class="infoPanel"><div class="infoPanelInner">' + task.description.replace(/\r\n/g, '<br/>') + '</div></div>');
    html.push('</div>');
    return html.join('');
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

function buildAllFlowchartsConnections(data, jsplumb) {
    var source;
    var target;

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
}

function initializePipeline(divNames, data, pipelineid, jsplumb) {
    for (var divId = 0; divId < divNames.length; divId++) {
        Q('#' + divNames[divId]).html('');
    }

    if (!data.pipelines || data.pipelines.length === 0) {
        Q('#pipeline-message-' + pipelineid).html('No pipelines configured or found. Please review the <a href="configure">configuration</a>')
    }

    jsplumb.reset();
}
