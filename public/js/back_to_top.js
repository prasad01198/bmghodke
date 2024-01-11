        document.addEventListener('DOMContentLoaded', function () {
            var backButton = document.querySelector('.back-to-home-button');
            window.addEventListener('scroll', function () {
                if (window.scrollY > 200) {
                    document.body.classList.add('show-back-to-home');
                } else {
                    document.body.classList.remove('show-back-to-home');
                }
            });

            // Smooth scrolling when clicking the button
            backButton.addEventListener('click', function (e) {
                e.preventDefault();
                document.body.classList.remove('show-back-to-home');
                document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE, and Opera
                document.body.scrollTop = 0; // For Safari
            });
        });