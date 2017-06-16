// Log an 'error' message on GAB log server.
var recordErrorMessage = function(msg, callback)
{
  recordMessageWithUserID(msg, 'error', callback);
};

// Log an 'status' related message on GAB log server.
var recordStatusMessage = function(msg, callback)
{
  recordMessageWithUserID(msg, 'stats', callback);
};

// Log a 'general' message on GAB log server.
var recordGeneralMessage = function(msg, callback)
{
  recordMessageWithUserID(msg, 'general', callback);
};

// Log an 'adreport' related message on GAB log server.
var recordAdreportMessage = function(msg) {
  recordMessageWithUserID(msg, 'adreport');
};

// Log an 'surveys' related message on GAB log server.
var recordAdreportMessage = function(msg) {
  recordMessageWithUserID(msg, 'surveys');
};

// Log a message on GAB log server. The user's userid will be prepended to the
// message.
// If callback() is specified, call callback() after logging has completed
var recordMessageWithUserID = function(msg, queryType, callback)
{
  if (!msg || !queryType)
  {
    return;
  }

  // Include user ID in message
  var fullUrl = 'https://log.getadblock.com/record_log.php?type=' + queryType + '&message=' + encodeURIComponent(STATS.userId() + ' f:' + STATS.flavor + ' o:' + STATS.os + ' ' + msg);
  sendMessageToLogServer(fullUrl, callback);
};

// Log a message on GAB log server.
// If callback() is specified, call callback() after logging has completed
var recordAnonymousMessage = function(msg, queryType, callback)
{
  if (!msg || !queryType)
  {
    return;
  }

  // Include user ID in message
  var fullUrl = 'https://log.getadblock.com/record_log.php?type=' + queryType + '&message=' + encodeURIComponent(msg);
  sendMessageToLogServer(fullUrl, callback);
};

// Log a message on GAB log server. The user's userid will be prepended to the
// message.
// If callback() is specified, call callback() after logging has completed
var sendMessageToLogServer = function(fullUrl, callback)
{
  if (!fullUrl)
  {
    return;
  }

  $.ajax({
    type : 'GET',
    url : fullUrl,
    success: function (text, status, xhr)
    {
      if (callback)
      {
        callback(text, status, xhr);
      }
    },
    error : function(xhr, textStatus, errorThrown)
    {
      log('message server returned error: ', textStatus, errorThrown);
      if (callback)
      {
        callback(errorThrown, textStatus, xhr);
      }
    },
  });
};

var postFilterStatsToLogServer = function(data, callback)
{
  if (!data)
  {
    return;
  }
  var payload = {'event':  'filter_stats', 'payload': data };
  $.ajax({
    jsonp: false,
    type: 'POST',
    url: "https://log.getadblock.com/v2/record_log.php",
    data: JSON.stringify(payload),
    success: function (text, status, xhr)
    {
      if (typeof callback === "function")
      {
        callback(text, status, xhr);
      }
    },
    error : function(xhr, textStatus, errorThrown)
    {
      log('message server returned error: ', textStatus, errorThrown);
      if (callback)
      {
        callback(errorThrown, textStatus, xhr);
      }
    },
  });
};