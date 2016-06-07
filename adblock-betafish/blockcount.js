   // Records how many malware requests have been blocked by AdBlock.
   // Also has the start property, which is the installation timestamp
    var malwareBlockCounts = (function() {
      var key = "blockage_stats";
      var data;
      ext.storage.get(key, function(response) {
        if (!response[key])
        {
          response[key] = {};
        }
        if (response[key]['start'] === undefined)
        {
          response[key]['start'] = Date.now();
        }
        if (response[key]['malware_total'] === undefined)
        {
          response[key]['malware_total'] = 0;
        }
        if (response[key]['version'] === undefined)
        {
          response[key]['version'] = 1;
        }
        data = response[key];
        ext.storage.set(key, data);
      });

      return {
        recordOneMalwareBlocked: function() {
          data.malware_total += 1;
          ext.storage.set(key, data);
        },
        get: function(callback) {
          return data;
        },
        getMalwareBlockedTotal: function(){
          return this.get().malware_total;
        },
        getInstallationTimestamp: function(){
          return this.get().start;
        }
      };
    })();