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
            timeout: 5000,
        })
        .done(function(data) {
            $("#output").html(data);
        })
        .fail(function(xhr, status, error) {
            $("#output").html('');
            window.open().document.write(xhr.responseText);
        });
    });
});
