/*-----------------------------------------------------------------------------------

    Template Name: Poco - Agency Bootstrap4 HTML5 Template
    Template URI: zakirsoft.com
    Description: Agency - Agency Bootstrap4 HTML5 Template
    Author: Templatecookie
    Author URI: zakirhossen.com
    Version: 1.0

-----------------------------------------------------------------------------------

    JS INDEX
    ===================

    01. Sticky Header
    02. Back to Top
    03. Hamburger Menu
    04. AOS Init

-----------------------------------------------------------------------------------*/

(function ($) {
  'use strict';

  /* Sticky Header */
  window.addEventListener('scroll', function () {
    let header = document.querySelectorAll('header');

    header.forEach((headItem) => {
      headItem.classList.toggle('sticky', window.scrollY > 0);
    });
  });

  /* Back to Top */
  var topBtn = $('#to-top');
  topBtn.on('click', function (e) {
    e.preventDefault();
    $('html, body').animate({ scrollTop: 0 }, '600');
  });

  /* Hamburger Menu */
  function toggleSidebar() {
    $('header aside').toggleClass('active');
    $('.hamburger-menu').toggleClass('open');

    var sidebarOpen = $('header aside').hasClass('active');
    if (sidebarOpen) {
      disableScrolling();
    } else {
      enableScrolling();
    }
  }

  $('.hamburger-menu').on('click', function () {
    toggleSidebar();
  });

  $('.close-sidebar').on('click', function () {
    toggleSidebar();
  });

  $('aside .overlay').on('click', function () {
    toggleSidebar();
  });

  /* AOS Init */
  AOS.init({
    duration: 1000,
    once: true,
  });

  function disableScrolling() {
    document.body.style.overflow = 'hidden';
  }

  function enableScrolling() {
    document.body.style.overflow = 'auto';
  }

})(jQuery);