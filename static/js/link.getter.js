$(document).ready(function() {
  $("#input").on("submit", function(a) {
    a.preventDefault();

    var inputData = $(this).serializeArray();

    function objectifyForm(formArray) {
      var returnArray = {};
      for (let i = 0; i < formArray.length; i++) {
        returnArray[formArray[i]["name"]] = formArray[i]["value"];
      }
      return returnArray;
    }

    var serializedData = objectifyForm(inputData);

    try {
      if (/magnet:\?xt=urn:[a-z0-9]+:[a-zA-Z0-9]*/.test(serializedData.url)) {
        var targetUrl = {
          get href() {
            return serializedData.url;
          }
        };
      } else {
        var targetUrl = new URL(serializedData.url);
      }
    } catch (err) {
      $("#output").html(
        "<input type='text' value='Invalid URL' name='link_out' autocomplete='off' />"
      );
      return;
    }

    $("#output").html(
      '<div class="span"><div class="typing_loader"></div></div>'
    );
    $("#submit").hide();

    setTimeout(function() {
      $("#submit").show();
      $("#output").html("");
    }, 15000);

    var currentUrl = new URL(location.href);
    currentUrl.pathname = btoa(targetUrl.href);
    location.href = currentUrl.href;
  });
});

$(window).load(function() {
  $(".lazyload").each(function() {
    $(this).attr("src", $(this).attr("data-src"));
  });
});

HTMLDocument.prototype.__defineGetter__("write", function() {
  return null;
});
