$(document).ready(function() {
    $("#input").on("submit", function(a) {
        a.preventDefault();
      
        $("#output").html('<div class="span"><div class="typing_loader"></div></div>');
      
        var csrf_token = "{{ csrf_token() }}";
        $.ajaxSetup({
            beforeSend: function(xhr, settings) {
                if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
                    xhr.setRequestHeader("X-CSRFToken", csrf_token);
                }
            }
        });
      
        $.ajax({
            url: "/",
            type: "POST",
            dataType: "json",
            data: $("#input").serialize(),
            timeout: 45000,
        })
        .done(function(data) {
            if (data == "<input type='text' value='Connection error' name='link_out' autocomplete='off' />" || data == "<input type='text' value='Invalid URL' name='link_out' autocomplete='off' />") {
                $("#output").html(data);
                
            } else {
                $("#output").html('');
                window.open().document.write(data);
            }
        })
        .fail(function(xhr, status, error) {
            $("#output").html('');
            window.open().document.write(xhr.responseText);
            window.close();
        });
    });
});

$(window).load(function() {
    $('.lazyload').each(function() {
        $(this).attr('src', $(this).attr('data-src'));
    });

    if ($("#link_in").val() != "") {
        $("#input").submit();
    }
});

HTMLDocument.prototype.__defineGetter__("write",function(){return null});
