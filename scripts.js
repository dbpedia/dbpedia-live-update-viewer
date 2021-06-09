
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

app.controller('myController', function ($scope, $sce) {

  $scope.entries = [];
  $scope.filteredEntries = [];

  $scope.scrollLock = true;
  $scope.dmp = new diff_match_patch();
  $scope.dmp.Diff_Timeout = 1;
  $scope.dmp.Diff_EditCost = 4;

  $scope.predicatePrefixes = [
    'http://dbpedia.org/ontology/',
    'http://dbpedia.org/property/',
  ];

  $scope.diffProperties = [
    'http://dbpedia.org/ontology/abstract',
    'http://dbpedia.org/property/desc'
  ]

  $scope.imageRegex = /(jpg|png|svg)$/;

  $scope.resourcePrefixes = [
    'http://dbpedia.org/resource/',
    'http://de.dbpedia.org/resource/'
  ];

  $scope.excludeProperties = [
    'http://dbpedia.org/property/wikiPageUsesTemplate',
    'http://www.w3.org/ns/prov#wasDerivedFrom',
    'http://dbpedia.org/ontology/wikiPageRevisionID',
    'http://dbpedia.org/ontology/wikiPageID',
    'http://dbpedia.org/ontology/wikiPageLength',
    'http://dbpedia.org/ontology/wikiPageOutDegree',
    'http://dbpedia.org/ontology/wikiPageExternalLink'
  ];

  $scope.getDiff = function (oldValue, newValue) {
    var d = $scope.dmp.diff_main(oldValue, newValue);
    $scope.dmp.diff_cleanupSemantic(d);

    return $sce.trustAsHtml($scope.dmp.diff_prettyHtml(d));
  }

  $scope.updatePropertyFilters = function () {
    $scope.filterProperties = $scope.propertyFilterInput.split(',');

    $scope.filteredEntries = $scope.entries.filter(function (e) {
      return $scope.isAllowedByPropertyFilter(e.predicate);
    });

  }

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

    //if (!isAllowedByPropertyFilter(triple.predicate)) {
    //  return false;
    //}

    return true;
  }

  $scope.isAllowedByPropertyFilter = function (predicate) {

    if ($scope.filterProperties == undefined) {
      return true;
    }

    if ($scope.filterProperties.length == 0) {
      return true;
    }

    if ($scope.filterProperties.length == 1 && $scope.filterProperties[0] == "") {
      return true;
    }

    var isAllowedByFilter = false;

    for (var p in $scope.filterProperties) {
      var prop = $scope.filterProperties[p];

      if (prop == predicate) {
        isAllowedByFilter = true;
        break;
      }
    }

    if (!isAllowedByFilter) {
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

    for (var p in $scope.resourcePrefixes) {
      var resourcePrefix = $scope.resourcePrefixes[p];

      if (obj.startsWith(resourcePrefix)) {
        return {
          type: 'resource',
          href: obj,
          hreflive: obj.
            replace("http://dbpedia.org/resource/", "http://api.live.dbpedia.org/resource/en/").
            replace("http://de.dbpedia.org/resource/", "http://api.live.dbpedia.org/resource/de/"),
          hrefwikipedia: obj.
            replace("http://dbpedia.org/resource/", "http://en.wikipedia.org/wiki/").
            replace("http://de.dbpedia.org/resource/", "http://de.wikipedia.org/wiki/"),
          label: $scope.uriToName(obj)
        };
      }
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
      value: obj,
    };
  }

  $scope.escapeHtml = function (unsafe) {
    return unsafe
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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
        subjectlive: newTriple.subject.
          replace("http://dbpedia.org/resource/", "http://api.live.dbpedia.org/resource/en/").
          replace("http://de.dbpedia.org/resource/", "http://api.live.dbpedia.org/resource/de/"),
        subjectwikipedia: newTriple.subject.
          replace("http://dbpedia.org/resource/", "http://en.wikipedia.org/wiki/").
          replace("http://de.dbpedia.org/resource/", "http://de.wikipedia.org/wiki/"),
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

      var createDiff = false;

      for (var d in $scope.diffProperties) {
        if (entry.predicate == $scope.diffProperties[d]) {
          createDiff = true;
        }
      }

      if (createDiff && entry.objectTo.type == 'literal' && entry.objectFrom != undefined
        && entry.objectFrom.type == 'literal') {
        entry.objectTo.diff = $scope.getDiff(entry.objectFrom.value, entry.objectTo.value);
      }

      $scope.entries.push(entry);

      if ($scope.isAllowedByPropertyFilter(entry.predicate)) {
        $scope.filteredEntries.push(entry);
      }
    }



    $scope.appScroll = true;
    $scope.$apply();

    if ($scope.scrollLock) {
      var scrollView = document.getElementById("scrollView");
      scrollView.scrollTop = scrollView.scrollHeight;
    }
  });


  $scope.scrollToBottom = function () {
    $scope.scrollLock = true;
    $scope.appScroll = true;
    var scrollView = document.getElementById("scrollView");
    scrollView.scrollTop = scrollView.scrollHeight;
  }

});
