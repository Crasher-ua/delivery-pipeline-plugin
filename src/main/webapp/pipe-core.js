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
