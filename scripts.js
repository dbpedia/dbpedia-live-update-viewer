
var app = angular.module("live-demo", []);

app.directive('scroll', [function () {
  return {
    link: function (scope, elem, attrs) {
      elem.on('scroll', function (e) {
        var el = elem[0];
        if (el.scrollTop != el.scrollHeight && !scope.appScroll) {
          scope.scrollLock = false;
        }

        scope.appScroll = false;
      });
    }
  }
}]);

app.controller('myController', function ($scope, $interval) {

  $scope.entries = [];

  $scope.scrollLock = true;

  $scope.predicateRegex =

    $scope.predicatePrefixes = [
      'http://dbpedia.org/ontology/',
      'http://dbpedia.org/property/',
    ];

  $scope.imageRegex = /(jpg|png|svg)$/;

  $scope.resourcePrefix = 'http://dbpedia.org/resource/'
  $scope.excludeProperties = [
    'http://dbpedia.org/property/wikiPageUsesTemplate',
    'http://www.w3.org/ns/prov#wasDerivedFrom',
    'http://dbpedia.org/ontology/wikiPageRevisionID',
    'http://dbpedia.org/ontology/wikiPageID',
    'http://dbpedia.org/ontology/wikiPageLength',
    'http://dbpedia.org/ontology/wikiPageOutDegree',
    'http://dbpedia.org/ontology/wikiPageExternalLink'
  ];

  $scope.filter = function (triple) {

    for (var e in $scope.excludeProperties) {
      if (triple.predicate.includes($scope.excludeProperties[e])) {
        return false;
      }
    }

    var hasMatchingPrefix = false;
    for (var p in $scope.predicatePrefixes) {
      if (triple.predicate.startsWith($scope.predicatePrefixes[p])) {
        hasMatchingPrefix = true;
        break;
      }
    }

    if (!hasMatchingPrefix) {
      return false;
    }

    return true;
  }


  $scope.uriToName = function (uri) {
    if (uri == null) {
      return null;
    }

    var result = uri.substr(uri.lastIndexOf('/') + 1);
    result = result.substr(result.lastIndexOf('#') + 1);
    result = result.replaceAll('_', ' ');
    return result;
  }

  $scope.formatObject = function (obj) {

    if (obj == undefined || obj.length == 0) {
      return undefined;
    }

    if (obj.startsWith($scope.resourcePrefix)) {
      return {
        type: 'resource',
        href: obj,
        label: $scope.uriToName(obj)
      };
    }

    try {
      var url = new URL(obj);

      if (url != undefined) {

        if (url.pathname.match($scope.imageRegex)) {
          return {
            type: 'image',
            href: obj,
            src: obj
          };
        }
      }


    } catch (err) { }

    return {
      type: 'literal',
      value: obj
    };
  }

  $scope.escapeHtml = function (unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  var evtSource = new EventSource("http://api.live.dbpedia.org/demo/diff-stream");
  evtSource.addEventListener("DBpedia Live Diff Event", function (event) {

    const diff = JSON.parse(event.data);

    //This matches everything between < > for Subject, Predicate or " " for objects
    let regex = /(?<=\<|\")(.*?)(?=\>|\")/g;

    var newTriples = [];
    var oldTriples = [];

    diff.oldTriples.split("\n").forEach(line => {
      if (line !== "") {
        let resourceArray = line.match(regex);
        var triple = {
          subject: $scope.escapeHtml(resourceArray[0]),
          predicate: $scope.escapeHtml(resourceArray[1]),
          object: $scope.escapeHtml(resourceArray[2])
        };

        if ($scope.filter(triple)) {
          oldTriples.push(triple);
        }
      }
    });


    diff.newTriples.split("\n").forEach(line => {
      if (line !== "") {
        let resourceArray = line.match(regex);
        var triple = {
          subject: $scope.escapeHtml(resourceArray[0]),
          predicate: $scope.escapeHtml(resourceArray[1]),
          object: $scope.escapeHtml(resourceArray[2])
        };

        if ($scope.filter(triple)) {
          newTriples.push(triple);
        }
      }
    });

    triples:
    for (var n in newTriples) {
      var newTriple = newTriples[n];

      var entry = {
        subject: newTriple.subject,
        predicate: newTriple.predicate,
        objectTo: newTriple.object
      };

      var noChange = false;

      // Find matching old triple
      for (var o in oldTriples) {
        var oldTriple = oldTriples[o];
        if (oldTriple.subject == entry.subject && oldTriple.predicate == entry.predicate) {

          if (oldTriple.object == entry.objectTo) {
            continue triples;
          }

          entry.objectFrom = oldTriple.object;
        }
      }

      entry.predicateLabel = $scope.uriToName(entry.predicate);
      entry.subjectLabel = $scope.uriToName(entry.subject);

      entry.objectTo = $scope.formatObject(entry.objectTo);
      entry.objectFrom = $scope.formatObject(entry.objectFrom);

      $scope.entries.push(entry);
    }

    $scope.appScroll = true;
    $scope.$apply();

    if ($scope.scrollLock) {
      var scrollView = document.getElementById("scrollView");
      scrollView.scrollTop = scrollView.scrollHeight;
    }
  });


  $scope.scrollToBottom = function() {
    $scope.scrollLock = true;
    $scope.appScroll = true;
    var scrollView = document.getElementById("scrollView");
    scrollView.scrollTop = scrollView.scrollHeight;
  }

});
