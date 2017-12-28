var isLoadingState = false

Template.video.rendered = function () {
  // $("#sidebar").sidebar('hide');
  $('html').animate({ scrollTop: 0 }, 'slow');//IE, FF
  $('body').animate({ scrollTop: 0 }, 'slow');
  Session.set('isShareOpen', false)
  Session.set('isDescriptionOpen', false)
  Template.video.setScreenMode();
  $(window).on('resize', Template.video.setScreenMode)
  Template.sidebar.resetActiveMenu()
  Template.settingsdropdown.nightMode();
  $('.ui.avatar.image img').visibility({
    type       : 'image',
    transition : 'fade in',
    duration   : 1000
  })
}

Template.video.helpers({
  user: function () {
    return {
      name: FlowRouter.getParam("author")
    }
  },
  activeUser: function () {
    return Session.get('activeUsername')
  },
  userVideosAndResteems: function () {
    var suggestions = Videos.find({ relatedTo: FlowRouter.getParam("author")+'/'+FlowRouter.getParam("permlink"), source: 'askSteem' }, { limit: 6 }).fetch();
    return suggestions;
  },
  author: function () {
    return ChainUsers.findOne({ name: FlowRouter.getParam("author") })
  },
  video: function () {
    var videos = Videos.find({
      'info.author': FlowRouter.getParam("author"),
      'info.permlink': FlowRouter.getParam("permlink")
    }).fetch()
    for (var i = 0; i < videos.length; i++) {
      if (videos[i].source == 'chainDirect') {
        Session.set("pageTitle", videos[i].info.title)
        return videos[i]
      }
    }

    for (var i = 0; i < videos.length; i++) {
      if (videos[i].source == 'chainByBlog') return videos[i]
      if (videos[i].source == 'chainByHot') return videos[i]
      if (videos[i].source == 'chainByCreated') return videos[i]
      if (videos[i].source == 'chainByTrending') return videos[i]
    }

    for (var i = 0; i < videos.length; i++) {
      if (videos[i].source == 'wakaArticles') return videos[i]
    }
    if (videos && videos[0]) return videos[0]
    return;
  },
  localIpfs: function () {
    return Session.get('localIpfs')
  },
  hasMoreThan4Lines: function () {
    var numberOfLineBreaks = (this.content.description.match(/\n/g) || []).length;
    if (numberOfLineBreaks >= 4) {
      return true;
    }
  },
  isLoggedOn: function () {
    return Session.get('activeUsername')
  },
  isOnMobile: function () {
    if (/Mobi/.test(navigator.userAgent)) {
      return true;
    }
  },
  convertTag:function(tag){
    var tagWithoutDtube= tag.replace("dtube-", "")
    return tagWithoutDtube
  },
  activatePopups:function(){
    $('[data-tcs]').each(function() {
      var $el = $(this);
      $el.popup({    
        popup: $el.attr('data-tcs'),
        on: 'hover',
        delay: {
          show: 0,
          hide: 100
        },
        position: 'bottom center',
        hoverable: true
      });
    });
  },
  // switchMobile: function () {
  //   $('#videodtube').addClass('videomobile');
  //   $('#videocontent').addClass('videomobile');
  // },
  // switchDesktop: function () {
  //   $('#videodtube').addClass('ui container').addClass('content');
  //   $('#videocontent').addClass('ui container').addClass('content');
  // }
})

Template.video.events({
  'click .upvote': function (event) {
    var author = FlowRouter.getParam("author")
    var permlink = FlowRouter.getParam("permlink")
    var weight = Session.get('voteWeight') * 100
    broadcast.vote(author, permlink, weight, function (err, result) {
      if (err) toastr.error(Meteor.blockchainError(err), translate('GLOBAL_ERROR_COULD_NOT_VOTE'))
      else toastr.success(translate('GLOBAL_ERROR_VOTE_FOR', weight / 100 + '%', author + '/' + permlink))
      Template.video.loadState()
    });
  },
  'click .downvote': function (event) {
    var author = FlowRouter.getParam("author")
    var permlink = FlowRouter.getParam("permlink")
    var weight = Session.get('voteWeight') * -100
    broadcast.vote(author, permlink, weight, function (err, result) {
      if (err) toastr.error(err.cause.payload.error.data.stack[0].format, translate('GLOBAL_ERROR_COULD_NOT_VOTE'))
      else toastr.success(translate('GLOBAL_ERROR_DOWNVOTE_FOR', weight / 100 + '%', author + '/' + permlink))
      Template.video.loadState()
    });
  },
  'click .replyTo': function (event) {
    Session.set('replyingTo', {
      author: $(event.target).data('author'),
      permlink: $(event.target).data('permlink')
    })
  },
  'click .submit': function (event) {
    if (!Session.get('replyingTo')) return;
    var parentAuthor = Session.get('replyingTo').author
    var parentPermlink = Session.get('replyingTo').permlink
    var body = $(event.currentTarget).prev().children()[0].value
    var jsonMetadata = {
      app: Meteor.settings.public.app
    }
    broadcast.comment(parentAuthor, parentPermlink, body, jsonMetadata, function (err, result) {
      console.log(err, result)
      if (err) {
        toastr.error(err.payload.error.data.stack[0].format, 'Error')
        return
      }
      Template.video.loadState()
      Session.set('replyingTo', null)
      document.getElementById('replytext').value = "";
    });
  },
  'click .subscribe': function () {
    var subCount = SubCounts.findOne({ account: FlowRouter.getParam("author") })
    subCount.follower_count++
    SubCounts.upsert({ _id: subCount._id }, subCount)
    Subs.insert({
      follower: Session.get('activeUsername'),
      following: FlowRouter.getParam("author"),
      what: ['blog']
    })
    
    broadcast.follow(FlowRouter.getParam("author"), function(err, result) {
      // alternative, inutile jusqua preuve du contraire
      // steem.api.getFollowCount(FlowRouter.getParam("author"), function(e,r) {
      //   SubCounts.upsert({_id: r.account}, r)
      // })
      if (err)
        toastr.error(Meteor.blockchainError(err))
    })
  },
  'click .unsubscribe': function () {
    var subCount = SubCounts.findOne({ account: FlowRouter.getParam("author") })
    subCount.follower_count--
    SubCounts.upsert({ _id: subCount._id }, subCount)
    Subs.remove({
      follower: Session.get('activeUsername'),
      following: FlowRouter.getParam("author")
    })
    broadcast.unfollow(FlowRouter.getParam("author"), function(err, result) {
      // finished unfollowing
      if (err)
        toastr.error(Meteor.blockchainError(err))
    })
  },
  'click .description': function () {
    if (Session.get('isDescriptionOpen')) {
      $('#descriptionsegment').addClass('closed');
      $('#truncateddesc').addClass('truncate');
      $('#showmore').removeClass('hidden');
      $('#showless').addClass('hidden');
    } else {
      $('#descriptionsegment').removeClass('closed');
      $('#truncateddesc').removeClass('truncate');
      $('#showmore').addClass('hidden');
      $('#showless').removeClass('hidden');
    }
    Session.set('isDescriptionOpen', !Session.get('isDescriptionOpen'))
  },
  'click .ui.share': function () {
    if (Session.get('isShareOpen'))
      $('#sharesegment').addClass('subcommentsclosed');
    else
      $('#sharesegment').removeClass('subcommentsclosed');

    Session.set('isShareOpen', !Session.get('isShareOpen'))
  },
  'click .editvideo': function() {
    $('#editvideosegment').toggle()
  },
  // 'mouseenter .upvote': function() {
  //   console.log('test')
  //   $('.upvote').popup({
  //     boundary: '.videocontainer',
  //     popup: '.popupupvotes'
  //   })
  // }
})

Template.video.setTime = function (seconds) {
  $('video')[0].currentTime = seconds
}

Template.video.loadState = function () {
  if (isLoadingState) return
  isLoadingState = true
  steem.api.getState('/dtube/@' + FlowRouter.getParam("author") + '/' + FlowRouter.getParam("permlink"), function (err, result) {
    if (err) throw err;
    console.log('Loaded video from chain')
    isLoadingState = false
    for (var key in result.accounts) {
      var user = result.accounts[key]
      try {
        user.json_metadata = JSON.parse(user.json_metadata)
      } catch (e) {
      }
      ChainUsers.upsert({ _id: user.id }, Waka.api.DeleteFieldsWithDots(user));
    }
    var video = Videos.parseFromChain(result.content[FlowRouter.getParam("author") + '/' + FlowRouter.getParam("permlink")])
    Session.set('videoDescription', video.content.description)
    video.comments = Videos.commentsTree(result.content, FlowRouter.getParam("author"), FlowRouter.getParam("permlink"))
    video.source = 'chainDirect'
    video._id += 'd'
    Videos.upsert({ _id: video._id }, video)
    Waka.api.Set({ info: video.info, content: video.content }, {}, function (e, r) {
      Videos.refreshWaka()
    })
  });
}

Template.video.loadFromChain = function (loadComments, loadUsers) {
  steem.api.getContent(FlowRouter.getParam("author"), FlowRouter.getParam("permlink"), function (err, result) {
    var video = Videos.parseFromChain(result)
    if (!video) return;
    video.source = 'chainDirect'
    video._id += 'd'
    Videos.upsert({ _id: video._id }, video)
    Waka.api.Set({ info: video.info, content: video.content }, {}, function (e, r) {
      Videos.refreshWaka()
    })
    if (!loadComments) return
    Template.video.loadComments(FlowRouter.getParam("author"), FlowRouter.getParam("permlink"), true)
  });
}

Template.video.loadComments = function (author, permlink, loadUsers) {
  Session.set('loadingComments', true)
  steem.api.getContentReplies(author, permlink, function (err, result) {
    var oldVideo = Videos.findOne({ 'info.author': author, 'info.permlink': permlink, source: 'chainDirect' })
    oldVideo.comments = result
    Videos.upsert({ _id: oldVideo._id }, oldVideo)

    var usernames = [oldVideo.info.author]
    for (var i = 0; i < oldVideo.comments.length; i++) {
      usernames.push(oldVideo.comments[i].author)
    }
    Session.set('loadingComments', false)
    if (!loadUsers) return
    ChainUsers.fetchNames(usernames)
  })
}

Template.video.pinFile = function (author, permlink, cb) {
  if (!Session.get('localIpfs')) return
  steem.api.getContent(author, permlink, function (e, video) {
    if (!video) return
    var video = Videos.parseFromChain(video)
    localIpfs.pin.add(video.info.snaphash, function (e, r) {
      console.log('pinned snap', e, r)
    })
    localIpfs.pin.add(video.content.videohash, function (e, r) {
      console.log('pinned video', e, r)
    })
  })
}
//.addClass('container') .addClass('container')
Template.video.setScreenMode = function () {
  if ($(window).width() < 1166) {
      $('.ui.maingrid').removeClass('container').removeClass('computergrid').addClass('tabletgrid').removeClass('grid');
  }
  else {
      $('.ui.maingrid').addClass('computergrid').addClass('container');
  }
}